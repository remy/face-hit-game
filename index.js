'use strict';

var express = require('express');
var uuid = require('node-uuid');
var Primus = require('primus');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var url = require('url');
var hbs = require('hbs');
var bodyParser = require('body-parser');
var colours = require('./colours');
// var store = new expressSession.MemoryStore();
var rtg = require('url').parse(process.env.REDISTOGO_URL || 'redis://localhost:6379');
var redis = require('redis').createClient(rtg.port, rtg.hostname);
var redisStore = require('connect-redis')(expressSession);
var store = new redisStore({ client: redis });
var lzString = require('./public/lz-string');


var app = express();
var server = require('http').createServer(app);
var secret = process.env.NODE_SECRET || 'mashed the keyboard';
var cookies = cookieParser(secret);
var session = expressSession({
  store: store,
  resave: true,
  saveUninitialized: true,
  secret: secret
});

hbs.registerHelper('decompress', function(image) {
  return lzString.decompressFromUTF16(image);
});

var port = process.env.PORT || 8000;

var activeUsers = {};
// var images = {};

redis.get('activeUsers', function (err, data) {
  activeUsers = JSON.parse(data || '{}');
});

// all environments
app.set('views', 'views');
app.set('view engine', 'hbs');
app.engine('hbs', hbs.__express);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookies);
app.use(session);

app.get('/', function (req, res) {
  res.render('index', {
    title: 'game',
    name: req.session.name,
    serverId: port,
  });
});

app.get('/scores', function (req, res) {
  req.session.wantsScores = true;
  res.render('scores', {
    serverId: port,
    title: 'scoreboard',
    activeUsers: Object.keys(activeUsers).map(function (id) {
      return {
        compressed: activeUsers[id].compressed,
        score: activeUsers[id].score,
        id: id,
        colour: activeUsers[id].colour,
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    }),
  });
});

app.use(express.static(__dirname + '/public'));

server.listen(port);

// -------------- PRIMUS ----------------

var primus = new Primus(server, {
  transformer: 'websockets',
  cluster: 10,
  redis: redis,
});

primus.use('spark-latency', require('primus-spark-latency'));
primus.use('metroplex', require('metroplex'));
primus.use('omega-supreme', require('omega-supreme'));
primus.use('emit', require('primus-emit'));

var Socket = primus.Socket;
var client = new Socket('http://localhost:' + port);

// use cookie and cookie-session middleware
primus.before('cookies', cookies);
primus.before('session', session);

client.on('user', function (data) {
  if (!activeUsers[data.id]) {
    activeUsers[data.id] = data;
  }
});

client.on('remove', function (data) {
  if (activeUsers[data.id]) {
    delete activeUsers[data.id];
  }
});

client.on('sendScoreboard', function (data) {
  redis.get('activeUsers', function (err, data) {
    activeUsers = JSON.parse(data || '{}');

    broadcast('scoreboard', {
      scores: Object.keys(activeUsers).map(function (user) {
        return {
          id: user,
          score: activeUsers[user].score
        };
      })
    });
  });
});


function broadcast(type, message, ignore) {
  if (!ignore) {
    ignore = {};
  }

  primus.metroplex.servers(function (err, servers) {
    servers.forEach(function (server) {
      primus.forward(server, {
        emit: [type, message]
      }, function (err, data) {
        // console.log.apply(console, [].slice.apply(arguments));
      });
    });
  });

  // note that the primus forward will handle this for us
  primus.forEach(function (spark) {
    if (spark.id === ignore.id) {
      return;
    }
    spark.emit(type, message);
  });
}

function updateCount() {
  broadcast('count', { total: primus.connected || 0, active: Object.keys(activeUsers).length }, {});
}

function sendScores() {
  setActiveUsers(function () {
    broadcast('sendScoreboard');
  });
}

function setActiveUsers(fn) {
  redis.set('activeUsers', JSON.stringify(activeUsers), fn || function () {});
}

var pendingReconnectFrom = {};

// listen on incoming connection
primus.on('connection', function(spark) {
  var req = spark.request;
  var user = req.session.user;

  if (pendingReconnectFrom[user]) {
    clearTimeout(pendingReconnectFrom[user]);
    delete pendingReconnectFrom[user]; // note: I know this isn't very memory efficient, but I forget why, and how to do better!
  }

  if (!user) {
    user = req.session.user = uuid.v4();
    req.session.save(); // force a save
  } else if (activeUsers[user]) {
    // update the spark pointer
    activeUsers[user].sparkId = spark.id;
    setActiveUsers();
  }

  updateCount();

  spark.on('end', function () {
    pendingReconnectFrom[user] = setTimeout(function () {
      if (user) {
        delete activeUsers[user];
        setActiveUsers();
        broadcast('remove', user, spark);
        updateCount();
      }
    }, 1500);
  });

  spark.on('hit', function (id) {
    if (!activeUsers[user]) {
      spark.emit('warning', 'You haven\'t given me your face, so you can\'t play yet!');
      return;
    }
    if (activeUsers[id]) {
      if (activeUsers[user].recent === id) {
        spark.emit('warning', 'You can\'t hit that face again for a while...');
      } else

      if (user === id) {
        activeUsers[user].score--;
        spark.emit('warning', 'You just hit yourself...duh');
      } else

      if (activeUsers[id].colour === activeUsers[user].colour) {
        activeUsers[user].score++;
        spark.emit('hit', id); // ack

        activeUsers[id].colour = colours();
        broadcast('colour', { colour: activeUsers[id].colour, id: id });

        primus.metroplex.spark(activeUsers[id].sparkId, function (err, server) {
          primus.forward(server, {
            emit: ['warning', 'You got hit - so your colour has changed!']
          }, activeUsers[id].sparkId, function (err, data) {});
        });
      }

      else {
        activeUsers[user].score--;
        spark.emit('warning', 'Nope, wrong colour');
      }

      // keep most recent 3 hits
      clearTimeout(activeUsers[user].recentTimer);
      activeUsers[user].recent = id; //.concat(activeUsers[user].recent.slice(0, 2));
      setTimeout(function () {
        if (activeUsers[user] && activeUsers[user].recent === id) {
          delete activeUsers[user].recent;
        }
      }, 5000);

    } else {
      activeUsers[user].score--;
      spark.emit('warning', 'Oi! Either there\'s something up with my code, or you sent me a duff user id - which is cheating, so I\'ve subtracted a point from you!');
    }
    spark.emit('score', activeUsers[user].score);
    sendScores();
  });

  // on reset, just send the ids of the user
  spark.emit('reset', { id: user, users: Object.keys(activeUsers) });

  // a touch later to allow for placeholders to be rendered
  spark.emit('users', activeUsers);
  if (activeUsers[user]) {
    spark.emit('score', activeUsers[user].score);
  }

  spark.on('user', function received(data) {
    if (!req.session.image) {
      req.session.image = data.compressed;
    } else {
      broadcast('change', user, spark);
      delete activeUsers[user];
      req.session.image = data.compressed;
    }
    req.session.colour = req.session.colour || colours();
    req.session.save();

    if (!activeUsers[user]) {
      activeUsers[user] = {
        sparkId: spark.id,
        id: user,
        recent: [],
        compressed: data.compressed,
        colour: req.session.colour,
        score: 0,
      };
      // images[user] = lzString.decompressFromUTF16(data.compressed);
    }

    broadcast('user', activeUsers[user], spark);
    spark.emit('colour', { id: user, colour: activeUsers[user].colour });
    setActiveUsers();
    updateCount();
  });

});

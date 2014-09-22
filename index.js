'use strict';

var express = require('express');
var uuid = require('node-uuid');
var Primus = require('primus');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var hbs = require('hbs');
var bodyParser = require('body-parser');
var colours = require('./colours');
var store = new expressSession.MemoryStore();
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

var primus = new Primus(server, {
  transformer: 'websockets'
});

var activeUsers = {};
var images = {};

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
    name: req.session.name
  });
});

app.get('/scores', function (req, res) {
  req.session.wantsScores = true;
  res.render('scores', {
    title: 'scoreboard',
    activeUsers: Object.keys(activeUsers).map(function (id) {
      return {
        image: images[id],
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

server.listen(process.env.PORT || 8000);

// -------------- PRIMUS ----------------

primus.use('emit', require('primus-emit'));
primus.use('spark-latency', require('primus-spark-latency'));

// use cookie and cookie-session middleware
primus.before('cookies', cookies);
primus.before('session', session);

function broadcast(type, message, ignore) {
  if (!ignore) {
    ignore = {};
  }

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
  primus.forEach(function (spark) {
    if (spark.request.session.wantsScores) {
      spark.emit('scoreboard', {
        scores: Object.keys(activeUsers).map(function (user) {
          return {
            id: user,
            score: activeUsers[user].score
          };
        })
      });
    }
  });
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
  }

  updateCount();

  spark.on('end', function () {
    pendingReconnectFrom[user] = setTimeout(function () {
      if (user) {
        delete activeUsers[user];
        broadcast('remove', user, spark);
        updateCount();
      }
    }, 500);
  });

  spark.on('hit', function (id) {
    if (!activeUsers[user]) {
      spark.emit('warning', 'You haven\'t given me your face, so you can\'t play yet!');
      return;
    }
    if (activeUsers[id]) {
      if (activeUsers[user].recent.indexOf(id) !== -1) {
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
        primus.spark(activeUsers[id].sparkId).emit('warning', 'You got hit - so your colour has changed!');
      }

      else {
        activeUsers[user].score--;
        spark.emit('warning', 'Nope, wrong colour');
      }

      // keep most recent 3 hits
      activeUsers[user].recent = [id]; //.concat(activeUsers[user].recent.slice(0, 2));

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
      images[user] = lzString.decompressFromUTF16(data.compressed);
    }

    broadcast('user', activeUsers[user], spark);
    spark.emit('colour', { id: user, colour: activeUsers[user].colour });
    updateCount();
  });

});

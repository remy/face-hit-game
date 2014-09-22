var primus = Primus.connect('/');

$(window).unload(function () {
  primus.end();
});

primus.on('warning', showWarning);
primus.on('hit', confirmHit);
primus.on('user', adduser);
primus.on('change', remove);

primus.on('reset', function (event) {
  $('#players').empty();
  myid = event.id;
  event.users.forEach(function (id) {
    $('#players').append('<li class="' + (id === myid ? 'me' : '') + '" id="user-' + id + '"><div class="holder"></div></li>');
  });
});

primus.on('users', function (users) {
  Object.keys(users).forEach(function (id) {
    var src = users[id].image || LZString.decompressFromUTF16(users[id].compressed);
    $('#user-' + id).html('<div style="border-color: ' + users[id].colour +'"><img src="' + src + '"></div>');
    if (id === myid) {
      updateColour(users[id].colour);
    }
  });
});

primus.on('remove', function (id) {
  $('#user-' + id).addClass('hide');
  setTimeout(function () {
     $('#user-' + id).remove();
  }, 1000);
});

primus.on('score', function (score) {
  $('#score').html('Score: ' + score);
})

primus.on('count', function (count) {
  $('#count').html('Active: ' + count.active + '<br>Sockets: ' + count.total);
});

primus.on('colour', function (data) {
  $('#user-' + data.id).find('div').css('border-color', data.colour);
  if (data.id === myid) {
    updateColour(data.colour);
  }
});

/*

function echo(type) {
  primus.on(type, function (event) {
    console.log('Event: %s', type, event);
  });
}

'remove reset user users open timeout reconnecting reconnect reconnected error end close connection disconnection online offline readyStateChange'.split(' ').forEach(echo);

*/
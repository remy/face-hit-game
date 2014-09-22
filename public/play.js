var primus = Primus.connect('/');

var users = {};

primus.on('data', function (event) {
  console.log(event);
  if (event.type === 'user') {
    newUser(event.data);
  }
});

function newUser(user) {
  $('#users').append('<img src="' + user.photo + "> " + user.name);
}
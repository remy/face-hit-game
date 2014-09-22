var primus = Primus.connect('/');

var scores = [];

function updateTable() {
  // this is slack, but update the scores, then sort the table
  var $scores = scores.sort(function (a, b) {
    return b.score - a.score;
  }).map(function (user) {
    var $user = $('#user-' + user.id).data('score', user.score);
    $user.find('span').html(user.score);
    return $user.parent();
  });

  $('tbody').html($scores);
}

function getScoresFromTable() {
  scores = $('td').map(function () {
    return {
      id: this.id.replace(/^user-/, ''),
      score: this.dataset.score
    }
  }).get();
}

primus.on('remove', function (id) {
  $('#user-' + id).remove();
  getScoresFromTable();
  updateTable();
});

primus.on('change', function (id) {
  $('#user-' + id).remove();
  getScoresFromTable();
  updateTable();
});

primus.on('reset', function (event) {
  if (event.users.length === 0) $('tbody').empty();
});

primus.on('scoreboard', function (event) {
  var latest = event.latest;
  scores = event.scores;
  updateTable();
});

primus.on('user', function (data) {
  var src = data.image || LZString.decompressFromUTF16(data.compressed);
  $('tbody').append('<tr><td style="background-color: ' + data.colour + '" id="user-' + data.id + '" data-score="' + (data.score || 0) + '"><img src="' + src + '"> <span>' + (data.score || 0) + '</span></td></tr>');
  getScoresFromTable();
  updateTable();
});


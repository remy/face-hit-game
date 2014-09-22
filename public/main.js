var users = {};
var holder = $('#loading').attr('src');
var myid = null;

if (!window.primus) {
  primus = {
    emit: function () {}
  };
}

function readfile(file) {
  var reader = new FileReader();

  reader.onload = function (event) {
    resize(event.target.result).then(function (src) {
      var compressed = LZString.compressToUTF16(src);

      if (myid) {
        remove(myid);
      }

      primus.emit('user', { compressed: compressed });

      adduser({
        id: myid,
        image: src
      });
    }).catch(function (error) {
      console.error(error.stack);
    });
  };
  reader.readAsDataURL(file);
}

$('#players').on('touchstart click', 'li', function (e) {
  e.preventDefault();
  var $div = $(this).find('div');
  if (!$div.is('.hide')) {
    var id = this.id.replace(/^user-/, '');
    primus.emit('hit', id);
  }
});

$('#mug').on('focus', function () {
  $('#upload').focus();
});

$('#upload').on('change', function () {
  readfile(this.files[0]);
});

alert('Instructions:\n1. Upload your face.\n2. You get a get colour.\n3. Score points by hitting the faces with same colour ring.');
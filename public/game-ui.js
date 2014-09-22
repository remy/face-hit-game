/* support drag and drop upload */
var root = document.documentElement;
root.ondragover = function () { this.className = 'dnd'; return false; };
root.ondragend = function () { this.className = ''; return false; };
root.ondragleave = function () { this.className = ''; return false; };
root.ondrop = function (e) {
  this.className = '';
  e.preventDefault();
  readfile(e.dataTransfer.files[0]);
}

/* resize the uploaded image to 100x100 jpeg @ 0.6 compression */
function resize(source) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.src = source;
    img.onload = function () {
      resolve(img);
    };
    img.onerror = reject;
  }).then(function (img) {
    var targetWidth = 100;

    var ctx = document.createElement('canvas').getContext('2d');

    var width = img.width > img.height ? img.height : img.width;
    ctx.canvas.width = ctx.canvas.height = targetWidth;

    var offsetX = 0;
    var offsetY = 0;

    if (img.width > img.height) {
      offsetX = (img.width - img.height) / 2;
    } else {
      offsetY = (img.height - img.width) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, width, width, 0, 0, targetWidth, targetWidth);
    return ctx.canvas.toDataURL('image/jpeg', 0.6);
  }, function (error) {
    console.log('error on image gen');
    throw error;
  });
}

var $warning = $('#warning');
var warnClear = null;

function showWarning(message) {
  $warning.html(message).addClass('show');
  clearTimeout(warnClear);
  warnClear = setTimeout(function () {
    console.log('clearing');
    $warning.removeClass('show');
  }, 3000);
}

function confirmHit(id) {
  var $hit = $('#user-' + id).find('div').addClass('hide');
  setTimeout(function () {
    $hit.removeClass('hide');
  }, 5000);
}

function updateColour(colour) {
  $('#colour').html(colour).parent().css('background-color', colour).removeAttr('hidden');
}

function remove(id) {
  $('#user-' + id + ' img:last').attr('id', 'removed-' + id).addClass('hide');
  setTimeout(function () {
     $('#removed-' + id).remove();
  }, 1000);
}

function adduser(data) {
  var src = data.image || LZString.decompressFromUTF16(data.compressed);
  // first try to replace the user
  $user = $('#user-' + data.id + ' div');
  if ($user.length) {
    $user.prepend('<img src="' + src + '">');
  } else {
    $('#players').append('<li class="' + (data.id === myid ? 'me' : '') +'" id="user-' + data.id + '"><div style="border-color:' + (data.colour || '#fff') + '"><img src="' + src + '"></div></li>');
  }
}
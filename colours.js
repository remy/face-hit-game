// via better colours
var colours = [
'blue     #0074D9'.split(' ').slice(-1).pop(),
'green    #2ECC40'.split(' ').slice(-1).pop(),
'orange   #FF851B'.split(' ').slice(-1).pop(),
// 'aqua     #7FDBFF'.split(' ').slice(-1).pop(),
// 'navy     #001F3F'.split(' ').slice(-1).pop(),
// 'teal     #39CCCC'.split(' ').slice(-1).pop(),
// 'olive    #3D9970'.split(' ').slice(-1).pop(),
// 'lime     #01FF70'.split(' ').slice(-1).pop(),
// 'yellow   #FFDC00'.split(' ').slice(-1).pop(),
// 'red      #FF4136'.split(' ').slice(-1).pop(),
// 'fuchsia  #F012BE'.split(' ').slice(-1).pop(),
// 'purple   #B10DC9'.split(' ').slice(-1).pop(),
// 'maroon   #85144B'.split(' ').slice(-1).pop(),
];

module.exports = function () {
  return colours[Math.random() * (colours.length) | 0];
}
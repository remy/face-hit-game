/*global performance*/
'use strict';
var engine = (function () {
  var MS_PER_UPDATE = 500;
  var noop = function () {};

  var Engine = function () {
    this.running = false;
    this.action = null;
  };

  Engine.prototype.start = function start() {
    this.running = true;
    frame();
  };
  Engine.prototype.stop = function stop() {
    this.running = false;
  };

  Engine.prototype.processInput = noop;
  Engine.prototype.update = noop;
  Engine.prototype.render = noop;

  // game loop
  var lag = 0;
  var last = performance.now();
  var frame = function frame() {
    if (!this.running) {
      return;
    }

    this.processInput();

    var now = performance.now();
    var elapsed = now - last;
    lsat = now;
    lag += elapsed;

    while (lag >= MS_PER_UPDATE) {    // time buffer
      this.update();

      if (this.running === false) {
        this.stop();
        break;
      }

      lag -= MS_PER_UPDATE;
    }

    this.render();

    requestAnimationFrame(frame);
  }.bind(this);

  return new Engine();

})();
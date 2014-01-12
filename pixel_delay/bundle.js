(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = mix

function toCMYK(color){
  var cyan    = 255 - color[0];
  var magenta = 255 - color[1];
  var yellow  = 255 - color[2];
  black   = Math.min(cyan, magenta, yellow);
  cyan    = ((cyan - black) / (255 - black));
  magenta = ((magenta - black) / (255 - black));
  yellow  = ((yellow  - black) / (255 - black));

  return {c:cyan,m:magenta,y:yellow,k:black/255,a:color[3]};
}

function toRGB(color){
  var R = color.c * (1 - color.k) + color.k;
  var G = color.m * (1 - color.k) + color.k;
  var B = color.y * (1 - color.k) + color.k;
  R = Math.round((1.0 - R) * 255.0 + 0.5);
  G = Math.round((1.0 - G) * 255.0 + 0.5);
  B = Math.round((1.0 - B) * 255.0 + 0.5);
  color = [R,G,B,Math.round(color.a)]
  return color;
}

function mix(color0,color01){
  var color1 = new Array(color0,color01);
  var C = 0;
  var M = 0;
  var Y = 0;
  var K = 0;
  var A = 0;
  for(var i=0;i<color1.length;i++){
    color1[i] = toCMYK(color1[i]);
    C += color1[i].c;
    M += color1[i].m;
    Y += color1[i].y;
    K += color1[i].k;
    A += color1[i].a;
  }
  C = C/color1.length;
  M = M/color1.length;
  Y = Y/color1.length;
  K = K/color1.length;
  A = A/color1.length;
  var color = {c:C,m:M,y:Y,k:K,a:A};
  color = toRGB(color);
  return color;
}

},{}],2:[function(require,module,exports){
var emitter = require('events').EventEmitter

navigator.getUserMedia = (navigator.getUserMedia || 
                        navigator.webkitGetUserMedia ||
                        navigator.mozGetUserMedia ||
                        navigator.msGetUserMedia);

module.exports = function(opts){
    
    var om = new emitter()
    
    navigator.getUserMedia(opts, function(stream){
        om.emit('stream', stream)
    }, function(err){
        alert('no webcam or no getUserMedia support detected.  Try Using Chome')
    })
    
    return om
}

},{"events":7}],3:[function(require,module,exports){
module.exports = pixecho

function pixecho(delay, ArrayType){
  if(!(this instanceof pixecho)) return new pixecho(delay, ArrayType);
  this.buffer = new ArrayType(delay * 2);
  this.writeOffset = 0;
  this.endpoint = delay * 2;
  this.readOffset = delay;
  return this
}

pixecho.prototype.read = function(){
  if(arguments.length) return this.buffer[arguments[0]]
  if(this.readOffset >= this.endpoint) this.readOffset = 0
  return this.buffer[this.readOffset++] 
}

pixecho.prototype.write = function(){
  if(arguments.length === 2) return this.buffer[arguments[1]] = arguments[0]
  if(this.writeOffset >= this.endpoint) this.writeOffset = 0;
  return this.buffer[this.writeOffset++] = arguments[0]
}

},{}],4:[function(require,module,exports){
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
},{}],5:[function(require,module,exports){
var camera = require('./xindex')
var videoEl = document.getElementById('source')
var mirror = document.getElementById('mirror')
var film = document.getElementById('film')
var print = document.getElementById('print')
var hideButton = document.getElementById('hide')
var mix = require('../color-mix');
var pixecho = require('./pixecho');
hideButton.style.display = "none"

var frameSize = 640 * 480;
var delayFrames =5 

var delay = pixecho(frameSize * delayFrames * 4, Uint8ClampedArray)

var userMediaStream = require('./getUserMedia.js')({audio: false, video: true})

    videoEl.style.display="none"
    mirror.style.display="none"
    film.style.display="none"
var log = false;
var exposure = 0
//setTimeout(function(){log = false}, 3000)
userMediaStream.on('stream', function(stream){
    
    videoEl.src = window.URL.createObjectURL(stream)
	
    var controller = camera(videoEl, mirror, film, print)
    
    var r = print.getContext('2d')
    
    controller.on('expose', function(data){
	var d = data.data
	for(var x = 0, i, color, arr = [], arrb = []; x < frameSize; x++){
            i = x * 4;
            arr[0] = delay.read() 
            arr[1] = delay.read() 
            arr[2] = delay.read() 
            arr[3] = delay.read() 
            arrb[0] = d[i]
            arrb[1] = d[i+1]
            arrb[2] = d[i+2]
            arrb[3] = d[i + 3]
            if(x==1)console.log(arrb)
            if(arr[0]){
              color = mix(arr, arrb)
         //     if(x==1) console.log(arr, arrb, color)
              color.forEach(function(e){ delay.write(e)})
	      d[i] = color[0]
              d[i + 1] = color[1]
              d[i + 2] = color[2]
              d[i + 3] = color[3]
            }
            else arrb.forEach(function(e){delay.write(e)})
	}
        r.putImageData(data, 0, 0)
    })  
})

/*
knob.delta = 0;
spin(knob)

knob2.delta = 0;
spin(knob2)

knob2.addEventListener('spin', function(evt){
    console.log(evt)
    this.delta += evt.detail.delta
    this.style['-webkit-transform'] = 'rotateZ('+ this.delta +'deg)'
})


knob.addEventListener('spin', function(evt){
    console.log(evt)
    this.delta += evt.detail.delta
    this.style['-webkit-transform'] = 'rotateZ('+ this.delta +'deg)'
})
*/


},{"../color-mix":1,"./getUserMedia.js":2,"./pixecho":3,"./xindex":6}],6:[function(require,module,exports){
require('./reqFrame')
var emitter = require('events').EventEmitter
var positive; 
var defaults = {
    shutterSpeed: 1,
    invert: false,
    blob: undefined,
    filmSpeed: {
        r: 1,
        g: 1,
        b: 1
    },
    r: 0,
    g: 0,
    b: 0,
    a: 255
};

module.exports = function(video, mirror, exposure, render){
    
    var reflection = mirror.getContext('2d')
    var positive = reflection.getImageData(0, 0, mirror.width, mirror.height) 
    var params = setParams({})

    var frameCount = 0;
    var delta = 0;
    
    var recording = false;
    var frames = [];

    
    var app = new emitter();
//    app.on('snapShot', snapShot)
  //  app.on('setParams', setParams)
    
    monitor()
    expose()
    
    var last = 0
    
    return app 
    
    function monitor(t){
	window.requestAnimationFrame(monitor)
	frameCount++
    	reflection.drawImage(video, 0, 0);
    }
    
    function setParams(p){
	if(!p) return;
	for (var attrname in defaults) {
            if(typeof p.filmSpeed == 'number'){
                var n = p.filmSpeed;
                p.filmSpeed = {
                    r: Math.max(n, .001),
                    g: Math.max(n, .001),
                    b: Math.max(n, .001)
                }
            }
            if(!p[attrname] && p[attrname] != 0) p[attrname] = defaults[attrname]
        }
        return p
    }
    
    function expose(p){
	
	if(p) params = setParams(p)

	var d = 0; 

        if(params.blob){
            positive = params.blob           
        }
        
        else {
            for(var m = 0; m < render.width * render.height; m++){
        	var index = m * 4;
        	positive.data[index] = params.r;
        	positive.data[index + 1] = params.g;
                positive.data[index + 2] = params.b;
                positive.data[index + 3] = params.a
            }   
        }

    	var frame;
    	
    	window.requestAnimationFrame(function(time){
    	    d = time + params.shutterSpeed
    	    frame = window.requestAnimationFrame(f)
    	})
    	
        function f(time){
            frame = window.requestAnimationFrame(f)

            var negative = reflection.getImageData(0,0,render.width,render.height);  
            
            for(n=0; n<render.width*render.height; n++) {  
                var index = n*4;   
                positive.data[index+0] =  vert(positive.data[index+0], negative.data[index+0] / params.filmSpeed.r);
                positive.data[index+1] = vert(positive.data[index+1], negative.data[index+1] / params.filmSpeed.g);
                positive.data[index+2] = vert(positive.data[index+2], negative.data[index+2] / params.filmSpeed.b);
                positive.data[index + 3] = params.a;
            }

            if(time > d) {
        	window.cancelAnimationFrame(frame)		
                app.emit('expose', positive)
        	expose();
    	        return
    	    }

        };
        
        function vert(a, b){
            if(params.invert){
                return a - b
            }
            else return a + b
        }
    }
    
}

},{"./reqFrame":4,"events":7}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[5])
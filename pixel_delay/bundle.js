(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/film/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"index.js"}
});

require.define("/film/xindex.js",function(require,module,exports,__dirname,__filename,process,global){require('./reqFrame')
var emitter = require('events').EventEmitter

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
    
    var film = exposure.getContext('2d')
    var print = render.getContext('2d')
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

    	var positive = print.getImageData(0,0, render.width, render.height)
        
        if(params.blob){
            var positive = params.blob           
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

            film.putImageData(positive, 0, 0)
            
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

});

require.define("/film/reqFrame.js",function(require,module,exports,__dirname,__filename,process,global){(function() {
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
});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
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
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
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

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/ndelay/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"delay.js"}
});

require.define("/ndelay/delay.js",function(require,module,exports,__dirname,__filename,process,global){var  funstance = require('funstance');

module.exports = function(delay, feedback, mix, bufferSize){
		
  var delay = Math.floor(delay)

  var feedback = feedback

  var mix = mix

  var bufferSize = bufferSize || delay * 2;

  if(bufferSize < delay * 2) bufferSize = delay * 2

  var d = new Delay(delay, feedback, mix, bufferSize)

  var fn = funstance(d, Sample)

  return fn

  function Delay(delay, feedback, mix, bufferSize){
			
	  this.feedback = feedback;
	
	  this.mix = mix;
	
	  this.delay = delay;

	  this.buffer = new Uint8ClampedArray(bufferSize);
	
	  this.writeOffset = 0;

	  this.endPoint = (this.delay * 2)
		
	  this.readOffset = this.delay + 1

          this.readZero = 0;
	
 	};


  function Sample(sample, _delay, feedback, mix){

      var s = sample;

      if(feedback) this.feedback = feedback;

      if(mix) this.mix = mix;

      if(_delay && _delay !== this.delay){

	  _delay = Math.max(0, Math.floor(_delay));
	  
	  if(_delay * 2 > this.buffer.length) {

	      var nb = new Uint8ClampedArray(_delay*3.5);

	      nb.set(this.buffer, 0);

	      this.buffer = nb		

  	  }

//	  if(_delay > this.delay) this.readZero = _delay - this.delay;
	  
	  this.delay = _delay;
	  
	  this.endPoint = (this.delay * 2);

      }
      
    if (this.readOffset >= this.endPoint) this.readOffset = 0;

    sample += (this.readZero-- > 0) ? 0 : (this.buffer[this.readOffset] * this.mix);

//    sample/=2

//    var write = sample * this.feedback

//    write = Math.floor(write)

    this.buffer[this.writeOffset] = (s + (sample * this.feedback)) / 2

    this.writeOffset++;

    this.readOffset++;

    if (this.writeOffset >= this.endPoint) this.writeOffset = 0;

    return isNaN(sample) ? Math.random() : sample

  };

};

});

require.define("/ndelay/node_modules/funstance/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"index.js"}
});

require.define("/ndelay/node_modules/funstance/index.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = function (obj, fn) {
    var f = function () {
        if (typeof fn !== 'function') return;
        return fn.apply(obj, arguments);
    };
    
    function C () {}
    C.prototype = Object.getPrototypeOf(obj);
    f.__proto__ = new C;
    
    Object.getOwnPropertyNames(Function.prototype).forEach(function (key) {
        if (f[key] === undefined) {
            f.__proto__[key] = Function.prototype[key];
        }
    });
    
    Object.getOwnPropertyNames(obj).forEach(function (key) {
        f[key] = obj[key];
    });
    
    return f;
};

});

require.define("/film/getUserMedia.js",function(require,module,exports,__dirname,__filename,process,global){var emitter = require('events').EventEmitter

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

});

require.define("/film/xentry.js",function(require,module,exports,__dirname,__filename,process,global){var camera = require('./xindex')
var videoEl = document.getElementById('source')
var mirror = document.getElementById('mirror')
var film = document.getElementById('film')
var print = document.getElementById('print')
var hideButton = document.getElementById('hide')
var ndelay = require('../../ndelay');

var delay = ndelay(640 * 480 * 4 * 20, 1, 1)

var userMediaStream = require('./getUserMedia.js')({audio: false, video: true})

hideButton.addEventListener('click', function(E){
    videoEl.style.display="none"
    mirror.style.display="none"
})
userMediaStream.on('stream', function(stream){
    
    videoEl.src = window.URL.createObjectURL(stream)
	
    var controller = camera(videoEl, mirror, film, print)
    
    var r = print.getContext('2d')
    
    controller.on('expose', function(data){
	var d = data.data
	for(var x = 0; x < d.length; x++){
	    d[x] = delay(d[x])
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


});
require("/film/xentry.js");
})();

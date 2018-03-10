/* jshint node: true */

var path = require('path');
var child = require('child_process');

var async = require('async');
var _ = require('lodash');

// Add the node_modules to the PATH
var nodeModulesBin = path.resolve(__dirname, 'node_modules', '.bin');
var parentNodeModulesBin = path.resolve(__dirname, '..', '.bin');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

// In node 0.10, 'buffer' is not a correct encoding... it uses Buffer.isEncoding.
// Further, even though Buffer.isEncoding allows 'raw', node 0.10 always does a
// Buffer.toString, where 'raw' is not allowed... since, you know, that's not a
// string. So hack it is... I am like 42% sure that I can ask for binary output
// and then convert that back to a buffer.
var VERSION = process.versions.node.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);
var BUFFER_ENCODING = +VERSION[1] === 0 && +VERSION[2] < 12 ? 'binary' : 'buffer';

function validateFunction(obj) {
    return _.isFunction(obj) ? obj : _.noop;
}

function getConfig(command) {
    var config = (typeof command === 'string') ? {
        task: command,
        cwd: process.cwd()
    } : command;
    
    config.encoding = config.encoding === 'buffer' ? BUFFER_ENCODING : 'utf8';
    
    return config;
}

function mergePaths() {
    
    var mergedPath = [].slice.call(arguments).reduce(function(memo, arg) {
        var p = arg.PATH || arg.Path || arg.path;

        if (!(_.isString(p) && p.length)) {
            return memo;
        }

        p = p.trim().replace(new RegExp(path.delimiter + '$'), '');

        return memo.concat(p.split(path.delimiter));
    }, []).join(path.delimiter);
    
    // because Windows, we need to overwrite all 3
    return {
        PATH: mergedPath
    };
}

function getEnv(config) {
    var env = newEnv(config.env, mergePaths(
        config.env || {},
        process.env,
        { PATH: nodeModulesBin },
        { PATH: parentNodeModulesBin }
    ));
    
    delete env.Path;
    delete env.path;
    
    return env;
}

function isIOStream(stream) {
    return process.stdin === stream ||
        process.stdout === stream ||
        process.stderr === stream;
}

function pipeStream(from, to, config) {
    var opts = isIOStream(to) ? { end: false } : { end: true };
    from.pipe(to, opts);
}

function collectStream(stream, encoding, callback) {
    var body = [];
    
    stream.on('data', function(chunk) {
        body.push(chunk);
    });

    stream.on('end', function() {
        var out = Buffer.concat(body);
        
        if (encoding !== BUFFER_ENCODING) {
            out = out.toString();
        }
        
        callback(undefined, out);
    });
}

function exec(command, done) {
    var config = getConfig(command);
    done = validateFunction(done);
    
    function encode(content) {
        // If these are not buffers when they are expected to be,
        // then we are in Node 0.10 and everythings sucks.
        if (config.encoding === BUFFER_ENCODING && !Buffer.isBuffer(content)) {
            return new Buffer(content, BUFFER_ENCODING);
        }
        
        return content;
    }
    
    var task = child.exec(config.task, {
        cwd: config.cwd || process.cwd(),
        env: getEnv(config),
        encoding: config.encoding
    }, function(err, stdout, stderr) {
        done(err, encode(stdout), encode(stderr));
    });
    
    if (config.stdout) {
        pipeStream(task.stdout, config.stdout);
    }
    
    if (config.stderr) {
        pipeStream(task.stderr, config.stderr);
    }
    
    if (config.stdin) {
        config.stdin.pipe(task.stdin);
    }
    
    return task;
}

function spawn(command, done) {
    done = validateFunction(done);
    var config = getConfig(command);
    
    var stdio = [ 'pipe', 'pipe', 'pipe' ];
    var pipeStdout = true;
    var pipeStderr = true;
    
//    if (isIOStream(config.stdout)) {
//        stdio[1] = config.stdout;
//        pipeStdout = false;
//    }
//    
//    if (isIOStream(config.stderr)) {
//        stdio[2] = config.stderr;
//        pipeStderr = false;
//    }
    
    var executable = platform === 'win' ? 'cmd.exe' : 'bash';
    var firstToken = platform === 'win' ? '/c' : '-c';
    var tokens = [firstToken, config.task];
    
    var opts = {
        env: getEnv(config),
        cwd: config.cwd || process.cwd(),
        stdio: stdio
    };
    
    if (platform === 'win') {
        opts.windowsVerbatimArguments = config.windowsVerbatimArguments !== false;
    }
    
    var task = child.spawn(executable, tokens, opts);
    
    task.on('error', function(err) {
        done(err);
    });
    
    var parallelTasks = {
        stdout: function(next) {
            collectStream(task.stdout, config.encoding, next);
        },
        stderr: function(next) {
            collectStream(task.stderr, config.encoding, next);
        },
        exitCode: function(next) {
            task.on('exit', function(code) {
                var err;
                if (code !== 0) {
                    err = new Error('Process exited with code: ' + code);
                    err.code = code;
                }
                next(err);
            });
        }
    };
    
    if (config.stdin && config.stdin.pipe) {
        config.stdin.pipe(task.stdin);
        
        // add a task to make sure this stream ends as well,
        // before exiting the task
        parallelTasks.stdin = function(next) {
            config.stdin.on('end', next);
        };
    }
    
    async.parallel(parallelTasks, function(err, results) {
        done(err || null, results.stdout, results.stderr);
    });
    
    if (pipeStdout && config.stdout) {
        pipeStream(task.stdout, config.stdout);
    }
    
    if (pipeStderr && config.stderr) {
        pipeStream(task.stderr, config.stderr);
    }

    return task;
}

function extendToString(target) {
    var args = [].slice.call(arguments, 1);
    
    function extend(to, from) {
        for (var i in from) {
            to[i] = from[i].toString();
        }
        
        return to;
    }
    
    args.forEach(extend.bind(null, target));
    
    return target;
}

function newEnv() {
    return extendToString.apply(
        null,
        [_.cloneDeep(process.env)].concat(_.filter(arguments, _.isPlainObject))
    );
}

// module.exports = exec;
module.exports = spawn;

module.exports.spawn = spawn;
module.exports.exec = exec;

module.exports.env = newEnv;

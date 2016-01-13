/* jshint node: true, -W030 */
/* global describe, it */

var chai = require('chai');
var expect = chai.expect;

var through = require('through2');
var es = require('event-stream');

var shellton = require('../shellton.js');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

function isRegex(val) {
    return Object.prototype.toString.call(val) === '[object RegExp]';
}

function addTests(shell) {
    function testSuccessResult(err, stdout, stderr, outVal, errVal) {
        expect(err).to.not.be.ok;
        expect(stdout).to.be.a('string');
        expect(stderr).to.be.a('string');
        
        if (typeof outVal === 'string') {
            expect(stdout.trim()).to.equal(outVal);
        } else if (isRegex(outVal)) {
            expect(stdout).to.match(outVal);
        }
        
        if (typeof errVal === 'string') {
            expect(stderr.trim()).to.equal(errVal);
        } else if (isRegex(errVal)) {
            expect(stderr).to.match(errVal);
        }
    }
    
    return function() {
        it('executes a string command', function(done) {
            shell('echo this is a test', function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test');
                done();
            });
        });

        it('executes a command with a full options object', function(done) {
            shell({ task: 'echo this is a test' }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test');
                done();
            });
        });
        
        it('takes a cwd', function(done) {
            var cwd = __dirname;
            shell({
                task: platform === 'win' ? 'dir' : 'ls',
                cwd: cwd
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, /main\.test\.js/i);
                done();
            });
        });
        it('takes an env', function(done) {
            var env = {};
            env.ABCD = 'testval';
            shell({
                task: platform === 'win' ? 'echo %ABCD%' : 'echo $ABCD',
                env: env
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'testval');
                done();
            });
        });
        
        describe('streams to', function() {
            function testStream(opts, stream, done) {
                var shellOut, streamOut, c = 0;

                function compare() {
                    if (c < 2) { return; }

                    expect(shellOut.toString()).to.equal(streamOut.toString());
                    done();
                }

                stream.pipe(es.wait(function(err, body) {
                    c++;
                    streamOut = body;
                    compare();
                }));

                shell(opts, function(err, stdout, stderr) {
                    c++;
                    shellOut = opts.stdout ? stdout : stderr;
                    compare();
                });    
            }
            
            it('an stdout stream', function(done) {
                var stream = through();
                var opts = {
                    task: 'echo this is a test',
                    stdout: stream
                };
                
                testStream(opts, stream, done);
            });
            it('an stderr stream', function(done) {
                var stream = through();
                var opts = {
                    task: 'echo this is a test 1>&2',
                    stderr: stream
                };
                
                testStream(opts, stream, done);
            });
        });

        it('does not call end on a process stream');
        it('calls end on any other stream');
        
        describe('streams from', function() {
            it('an stdin stream', function(done) {
                if (shell === shellton.spawn) {
                    return this.skip();
                }
                
                var input = through();
                var opts = {
                    task: 'node -e "process.stdin.pipe(process.stdout)"',
                    stdin: input
                };
                
                shell(opts, function(err, stdout, stderr) {
                    testSuccessResult(err, stdout, stderr, 'this is a test');
                    done();
                });
                
                input.end('this is a test\n');
            });
        });

        describe('calls a callback', function() {
            it('with err if the command does not exist', function(done) {
                var notExistErrCode = platform === 'win' ? 1 : 127;
                
                shell('command-does-not-exist-435632', function(err, stdout, stderr) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.code).to.equal(notExistErrCode);
                    done();
                });
            });
            it('with an stdout parameter', function(done) {
                shell('echo this is a test', function(err, stdout, stderr) {
                    expect(stdout).to.not.be.undefined;
                    testSuccessResult(err, stdout, stderr, 'this is a test');
                    done();
                });
            });
            it('with an stderr parameter', function(done) {
                shell('echo this is a test 1>&2', function(err, stdout, stderr) {
                    expect(stderr).to.not.be.undefined;
                    testSuccessResult(err, stdout, stderr, undefined, 'this is a test');
                    done();
                });
            });
        });    
    };
}

//describe('[Module Export]', addTests(shellton));
describe('[Spawn]', addTests(shellton.spawn));
describe('[Exec]', addTests(shellton.exec));

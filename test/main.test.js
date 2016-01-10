/* jshint node: true */
/* global describe, it */

var chai = require('chai');
var expect = chai.expect;

var shellton = require('../shellton.js');

function addTests(shell) {
    function testSuccessResult(err, stdout, stderr, outVal, errVal) {
        expect(err).to.not.be.ok;
        expect(stdout).to.be.a('string');
        expect(stderr).to.be.a('string');
        
        if (outVal !== undefined) {
            expect(stdout.trim()).to.equal(outVal);
        }
        
        if (errVal !== undefined) {
            expect(stderr.trim()).to.equal(errVal);
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
            shell('echo this is a test', function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test');
                done();
            });
        });
        
        it('takes a cwd');
        it('takes an env');
        it('takes an stdout stream');
        it('takes an stderr stream');

        it('does not call end on a process stream');
        it('calls end on any other stream');

        describe('calls a callback', function() {
            it('with err if the command does not exist');
            it('with an stdout parameter');
            it('with an stderr parameter');
        });    
    };
}

//describe('[Module Export]', addTests(shellton));
describe('[Spawn]', addTests(shellton.spawn));
describe('[Exec]', addTests(shellton.exec));

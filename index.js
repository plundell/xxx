;'use strict';
/*
* @part-of xxx-framework
* @author x7dude
* @license Apache-2.0
* @depends libbetter
* @depends smarties
* @description This file can be built directly with webpack to produce a script that needs to be loaded AFTER the dependencies
*              have been set on the window
*/
window.xxx=require('src/xxx.proto.js')(window);


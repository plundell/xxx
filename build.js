;'use strict';
/*
* @module xxx-framework
* @author plundell
* @license Apache-2.0
* @depends libbetter
* @depends smarties
* @exports function   This framework exports an "exporter function" which should be called with the 
*                     dependencies to get the "real exported contents". It also creates a getter on
*                     window.xxx which runs said exporter if the dependencies are also set on the window
*/

if(window)
	throw new Error("ESCOPE. This script should have access to the 'window' global.");

//Load the "exporter function". Mansplain: using an exporter implies no external dependencies need
//to be require()'d from any internal script, which gives more control as to when and how these 
//dependencies are loaded, which in turn allows devs to supply other/altered/experimental versions.
const exporter=require('src/xxx.proto.js');

//Create a getter on the window which runs the exporter as soon as all dependencies are
//available OR throws a clear error if we try to access it too early
Object.defineProperty(window,'xxx',{enumerable:true, configurable:true
	,get:()=>{
		if(window.Smarties && window.BetterLog && window.BetterEvents && window.BetterUtil){ 
			return window.xxx=exporter(window);
		}else{
			throw new Error("The xxx-framework could not be initialized because it's dependencies "
				+"have not been set on the global scope");
		}
	}
	//This setter allows^ the whole thing to easily be undone/overwritten
	,set:(val)=>{
		Object.defineProperty(window,'xxx',{value:val,enumerable:true,writable:true,configurable:true}); 
		return val;
	} 
})
   


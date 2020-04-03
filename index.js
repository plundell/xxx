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

(function(){
	//Load the "exporter function". Mansplain: using an exporter implies no external dependencies need
	//to be require()'d from any internal script, which gives more control as to when and how these 
	//dependencies are loaded, which in turn allows devs to supply other/altered/experimental versions.
    const proto=require('src/xxx.proto.js');

    //Pass it along to anyone requiring this module
    if(typeof module==='object' && module.exports){
        module.exports = proto;
    }

    //Create a getter on the window which runs the exporter as soon as all dependencies are
    //available OR throws a clear error if we try to access it too early
    if(window){
    	Object.defineProperty(window,'xxx',{enumerable:true, configurable:true
    		,get:()=>{
	    		if(window.Smarties && window.BetterLog && window.BetterEvents && window.BetterUtil){ 
	    			return window.xxx=proto(window);
	    		}else{
	    			throw new Error("The xxx-framework could not be initialized because it's dependencies "
	    				+"have not been set on the global scope");
	    		}
	    	}
	    	//This setter allows^ the whole thing to easily be undone/overwritten
	    	,set:(val)=>{
	    		Object.defineProperty(window,'xxx',{value:xxx,enumerable:true,writable:true,configurable:true}); 
	    		return val;
	    	} 
    	})
    }
   
}())

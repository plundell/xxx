//simpleSourceMap=/my_modules/xxx/xxx.proto.js
//simpleSourceMap2=/lib/xxx/xxx.proto.js
;'use strict';
/*
* @component Prototype
* @part-of xxx-framework
* @author plundell
* @license Apache-2.0
* @description This is the main file of the frontend xxx-framework. It requires the other components and produces an
*              object containing their constructors: Binder, Navigator, Repeater.
* @depends libbetter
* @depends smarties
* @exports function   This framework exports an "exporter function" which should be called with the 
*                     dependencies to get the "real exported contents". 
*/


module.exports=function exportXXX(dep){

	//The passed in object should contain all the dependencies.
	function missingDependency(which){
		console.warn('Dependency:',dep);
		throw new Error("xxx-framework was initialized without/before a required dependency: "+which);
	}
	if(!dep.BetterUtil) missingDependency('BetterUtil');
	if(!dep.BetterLog) missingDependency('BetterLog');
	if(!dep.BetterEvents) missingDependency('BetterEvents');
	if(!dep.Smarties) missingDependency('Smarties');

	const bu = dep.BetterUtil



	//Is populated and returned/exported at bottom
	var _export={};
	

	//Create a static log for all static functions to use
	var xxxLog=new dep.BetterLog('xxx-framework');


	/*
	* Get an instance of BetterLog when we're not sure what context something is being called in
	* @opt object self
	* @return <BetterLog>
	* @proto
	*/
	function getLog(...alts){
		let log=alts.find(self=>{
			if(self){
				if(self._isBetterLog)
					return self;
				else if(self.log && self.log._isBetterLog)
					return self.log;
				else if(self._log && self._log._isBetterLog)
					return self._log
			}
		})
		return xxxLog;
	}


	//Create the css rule we use to hide nodes
	try{
		let rule=bu.createCSSRule('.xxx-hide','display:none !important');
		xxxLog.info("Created CSS rule for class 'xxx-hide', used by the xxx framework to hide elements.",rule);
	}catch(err){
		xxxLog.error("Failed to create css rule to hide elements. Hiding elements with this framework WILL NOT WORK NOW.",err);
	}
	




	/*
	* Read instructions from attributes on a node. 
	*
	* @param <HTLMElement> 	node 		A live node to get instructions from
	* @opt <BetterLog> 		log 		Will log info or warn if instructions where/not found
	* @opt function 		cb 			Each instruction is called with this. It can alter the instruction. If it returns 'drop'
	*									 the instruction will be dropped silently, if it throws it will be dropped with an err log
	* @opt @flag 			'extract' 	The attributes will be removed from the node
	* @opt @flag 			'emptyOK' 	Will prevent warnings when no instructions where found
	* @opt @flag 			'group' 	Groups instructions by key, returning an object of arrays
	*
	* NOTE: we also look for sub-attributes of format "$baseAttr-foo" where foo will be used as the "fn" prop on returned inst
	* NOTE2: sub-attribute values that are not full json objects will be used as the "key" prop on returned inst
	*
	* @throw <TypeError> 	If arg#1 or arg#2 is wrong type
	*
	* @return array[obj]|obj[arr[obj]] 		An array of instruction objects (can be empty if none exists), or @see $group
	*
	* @call(xxx instance) 	For logging + this.constructor._baseAttr
	*/
	function getInstructions(node,...optional){
		bu.checkType('node',node);
		const log=getLog(this);
		try{
			//Initiate array that will be returned (unless 'group' is passed vv)
			var instructions=[];

			var baseAttr=this.constructor._baseAttr;
			var cb=bu.getFirstOfType(optional, 'function');
			var extract=optional.includes('extract');
			var group=optional.includes('group');
			var emptyOK=optional.includes('emptyOK'); //Since individual nodes in eg. templates with multiple children
													//may not have instructions, one may want to NOT warn

			/*
			* Adds each instruction to the overall return array
			* @param object inst
			* @return void
			* @no_throw
			*/
			var addInstruction=(inst)=>{
				//Use the global key if none is specified (ie. the key used for all instructions for the node, see vv)
				inst.key=inst.key||globalKey;

				let t=bu.checkProps(inst,{
					fn:'string'
					,key:['number','string','array']
					,args:['array','primitive','undefined']
					,arg:['primitive','undefined'] //only used if args==undefined. the resulting prop will still be args=[...]
					,test:['array','primitive','undefined']
				});
				//REMEMBER: ALL keys on the inst obj are passed to the action function, BUT, also remember
				//that props on the 'event' object supersede them, and the prop 'node' will be set to the
				//node being acted upon
				
				//All functions are lower case, but they can be written however just to make it more legible
				inst.fn==inst.fn.toLowerCase();
				

				//Args should be an array (if nothing else an empty one)...
				if(t.args=='primitive')
					inst.args=[inst.args]
				else if(t.args=='undefined'){
					if(t.arg=='primitive')
						inst.args=[inst.arg];
					else
						inst.args=[];
				}

				
				//If testing is desired, prepare that array. It will be used by executeAction() to check the value
				if(t.test!='undefined'){
					if(t.test=='primitive'){
						inst.test=bu.compare.splitOnOperator(inst.test) //may leave inst.test[0] == undefined, see vv
					}else if(t.test=='array'){
						if(inst.test.length==1){
							inst.test=bu.compare.splitOnOperator(inst.test[0]) //may leave inst.test[0] == undefined, see vv
						}else{
							//Make sure the array starts with an operator
							let i=inst.test.findIndex(bu.compare.isOperator)
							if(i==-1) throw new Error('No compare operator found');
							if(i!=0) inst.test.unshift(t.test.splice(i,1)); //move to front
						}
					}
					if(!inst.test[0])
						inst.test[0]='===' //compare() would do this anyway, but the logstr would miss it
				}


				//Before adding it, call the optional callback. I
				if(cb && cb(inst)=='drop'){
					return;
				}
					
				instructions.push(inst);
			}
			var badInst=(str,attr,node,err)=>{
				node.setAttribute(attr+'_fail',str);
				node.removeAttribute(attr);
				log.error(`Bad ${attr} instructions on node:`,node,err);
			}

			//There are 3 ways/places we can find instructions:
				//1. A "global attribute" that defines the key for all other instructions. NOTE the use of '_' 
				//   instead of '-'
				var globalKey=bu.tryJsonParse(node.getAttribute(baseAttr+'_key'));

				//2. As a json obj/arr on the $baseAttr (this is necessary in case we want to use the same
				//   action multiple times, like setting multiple attributes)
				var str=node.getAttribute(baseAttr);
				// console.log(baseAttr,node,str);
				if(str){
					try{
						let singleOrMultiple=JSON.parse(str);
						if(bu.checkType(['array','object'],singleOrMultiple)=='object'){
							addInstruction(singleOrMultiple)
						}else{
							//TODO 2020-02-05: Don't fail all just because one instruction is bad...
							singleOrMultiple.forEach(addInstruction)
						}

						if(extract)
							node.removeAttribute(baseAttr);	

					}catch(err){
						badInst(str,baseAttr,node,err)
					}

				}

				//3. On sub-attributes of format '$baseAttr-fn'
				var obj=bu.getSubAttributes(node, baseAttr+'-',extract);
				for(let fn in obj){
					// console.log(baseAttr+'-'+fn,obj[fn],node);
					try{
						if(fn.includes('_fail'))
							continue;

						//obj[fn] should be a primitive or undefined here, not empty string...

						let x=bu.tryJsonParse(obj[fn]);
						if(bu.varType(x)=='object'){
							//x is an entire inst object with key and args
							x.fn=fn;
							addInstruction(x);
						}else{
							let last=bu._log.last();
							  //^yes, it should be bu._log, we're checking the log used by bu.tryJsonParse()
							if(last && last.msg.includes('poorly formated JSON string')){
								last.throw();
							}else if(globalKey){
								//since we already have a global key, x can be a single arg or 
								//an array of args or undefined
								addInstruction({'args':x,'fn':fn}); 
							}else{
								//since we need a key, x has to be a single key or an array of 
								//keys (push() will type check)
								addInstruction({'key':x,'fn':fn});
							}
						} 
					}catch(err){
						badInst(obj[fn],baseAttr+'-'+fn,node,err)
					}
				}
				

			if(!bu.isEmpty(instructions)){
				log.debug(`Found ${baseAttr} instructions on node: `,node,instructions);
			}else if(!emptyOK && !node.hasAttribute(baseAttr+'_noaction')){
				//If the node is expected to have instructions, warn that it doesn't
				log.warn(`Node doesn't have ${baseAttr} instructions: `,node); 
			}

		}catch(e){
			log.error("BUGBUG",e).addHandling('arguments:',arguments);	
		}
		
		//Turn into object if opted... Do this after try/catch so we're ensured to return an object if expected
		if(group){
			instructions=groupByKey(instructions); //doesn't throw, always returns object
		}

		return instructions;
	}



	/*
	* @param array instructions 	Array of instruction objects, eg. 
	*									[{key:a, fn:show}, {key:a, fn:text},{key:b, fn:click}]
	*
	* @return object 				Keys are keys, values are nested arrays like $instructions but all with same key
	*									{a:[{key:a, fn:show}, {key:a, fn:text}],b:[{key:b, fn:click}]}
	*/
	function groupByKey(instructions){
		try{	
			var obj={};
			instructions.forEach(inst=>{
				if(Array.isArray(inst.key)){
					inst.key.forEach(key=>bu.pushToNestedArray(obj,key,inst)); //ie. the same instruction can be added to multiple arrays
				}else{
					bu.pushToNestedArray(obj,inst.key,inst);	
				}
			})

			//Add a few func for convenience
			Object.defineProperty(obj,'keys',{value:function keys(){return Object.keys(obj)}})
			Object.defineProperty(obj,'values',{value:function values(){return instructions}})
			Object.defineProperty(obj,'length',{get:()=>instructions.length})

		}catch(e){
			getLog(this).error("BUGBUG",e).addHandling('arguments:',arguments);	
		}
		return obj;
	}






























	




	/*
	* Show or hide a node if a condition evaluates to true, else do the opposite
	*
	* @param boolean 		showOnTruthy
	* @param object 		x  				An object containing the following:
	*   @prop elem 			node 			  The node to operate on
	*   @prop any 		 	value 			  The new value of the prop on the xxx instance. Used to determine hide/show, see @showIf
	* 	@opt array 			test  			  @see test2()
	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function setDisplay(showOnTruthy, x){
		var c=test2.call(this,x);
		if(c.test==showOnTruthy){
			this._log.trace('Showing node:',x.node,c.logstr);
			showElement(x.node);
		}else{
			this._log.trace('Hiding node:',x.node,c.logstr);
			hideElement(x.node);
		}
		return;
	}





	/*
	* Hide an elem in the DOM. Always works and remembers last display
	*
	* @param mixed node 	@see bu.getLiveElement
	*
	* @return void
	* @static 		 set on proto.static	
	*/
	function hideElement(node){
		node=bu.getLiveElement(node);

		//Always add our hide-class
		node.classList.add('xxx-hide');

		//Then make sure it's hiding (and save any display value set on the element which can be
		//restored by showElement later)
		bu.hideElement(node);

		return;

	}


	/*
	* Show a hidden elem in the DOM. Always works and restores previous display if available
	*
	* @param mixed node 	@see bu.getLiveElement
	*
	* @return void
	* @static 		 set on proto.static	
	*/
	function showElement(node){
		node=bu.getLiveElement(node);

		//Always remove our class
		node.classList.remove('xxx-hide');

		//Then make sure it's showing 
		bu.showElement(node); //will have no effect if already showing

	}



	/*
	* Add a class and remove another
	*
	* @param object 		x  		  An object containing the following:
	*   @prop elem 				node 	The node to operate on
	*   @prop any 		 		value 	New class to add
	*   @prop string|undefined 	old 	Old class to remove	

	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function followClass(x){
		// this._log.traceFunc(arguments);
		var bug="BUGBUG: followClass() was called with the string 'undefined', probably a mistake."
		var logStr='';
		if(x.old && typeof x.old=='string'){
			if(x.old=='undefined'){
				this._log.warn(bug,arguments);
				return;
			}
			logStr+=`Removing class '${x.old}'`
			x.node.classList.remove(x.old);
		}

		if(typeof x.value=='string'){
			if(x.value=='undefined'){
				this._log.warn(bug,arguments);
				return;
			}
			logStr+=(logStr?' and a':'A')+`dding class '${x.value}'`
			x.node.classList.add(x.value)
		}
		if(!logStr)
			this._log.warn("Something went wrong. Class has probably NOT been updated. \narguments:",arguments);
		else
			this._log.trace(logStr,x.node);

		if(x.node.classList && !x.node.classList.length)
			x.node.removeAttribute('class');
	}



	/*
	* Add/remove a class given a value and condition
	*
	* @param object 		x  				An object containing the following:
	*   @prop elem 			node 			  The node to operate on
	*   @prop any 		 	value 			  The new value of the prop on the xxx instance. Used to determine if we're setting or removing $cls
	* 	@prop string 		args|arg|cls 	  The class to set
	* 	@opt array 			test  			  @see test2()
	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function toggleClass(x){
		let cls=x.cls||x.args[0];
		bu.checkType('string',cls);
		if(cls=='undefined'){
			this._log.throw("toggleClass() was called with the string 'undefined', probably a mistake.",x);
		}

		//Determine if we're adding or removing class	
		let c=test2.call(this,x);

		if(c.test){
			if(x.node.classList.contains(cls)){
				this._log.trace(`Node already has class '${cls}'.`,x.node);
			}else{
				this._log.trace(`Adding class '${cls}' to node:`,x.node);
				x.node.classList.add(cls);
			}
		}else{
			if(x.node.classList.contains(cls)){
				this._log.trace(`Removing class '${cls}' from node:`,x.node);
				x.node.classList.remove(cls);
			}else{
				this._log.trace(`Node correctly doesn't have class '${cls}'.`,x.node);
			}
		}
		return;
	}


	/*
	* Set a prop directly on the node to the underlying value. 
	*
	* @param object 	x  				An object containing the following:
	*   @prop elem 		 node 			  The node to operate on
	*   @prop any	 	 value 			  The new value of the prop on the xxx instance. Used as the elemts prop value value,
	* 	@prop string 	 args|arg|prop 	  The prop to set
	*
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function followProp(x){
		let prop=x.prop||x.args[0];
		bu.checkType('string',prop);
		this._log.trace(`Setting prop '${prop}' = ${x.value}`,x.node);
		x.node[prop]=x.value
		return;
	}


	/*
	* Set a prop directly on the node if the underlying value passes a test. The prop is set to $value or optional $trueValue/$falseValue
	*
	* @param object 	x  				An object containing the following:
	*   @prop elem 		 node 			  The node to operate on
	*   @prop any	 	 value 			  The new value of the prop on the xxx instance. Used to test if we're setting the prop
	* 	@prop array 	   args
	*	  @arg string 		 propName		The prop to set
	*	  @arg @opt any 	 trueValue 		Defaults to $value. The value to set if the test returns truthy
	*	  @arg @opt any 	 falseValue 	If omitted, the value of the prop will not be touched if test fails (which enables you to
	*										  have multiple actions on the same node to create a 'case' scenario)
	* 	@opt array 			test  			@see test2()								 
	*
	*
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function toggleProp(x){
		let prop=x.args[0]
			,trueValue=x.args.length>1 ? x.args[1] : x.value
			,falseValue=x.args[2] //defaults to undefined
		 	,c=test2.call(this,x)
			,v=c.test ? trueValue : falseValue
		;
		this._log.trace(`Setting prop '${prop}' = ${v}`,x.node,c.logstr);
		x.node[prop]=v; 
		return;
	}


	/*
	* Set an attribute to the underlying $value, or to $trueValue if $value passes a test
	*
	* @param object 		x  				An object containing the following:
	*   @prop elem 			 node 			  The node to operate on
	*   @prop any 		 	 value 			  The new value of the prop on the xxx instance. Used as the attribute value and to test
	*											if the attribute should be removed.
	* 	@prop array 	   args
	*	  @arg string 		attrName		The attribute to set
	*	  @opt string 		trueValue 		Defaults to $value. The value to set if the test returns truthy.
	* 	@opt array 			 test  			  @see test2(). A falsey test removes the 
	*								    		attribute entirely from the element.
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function setAttribute(x){
		bu.checkTypes(['string',['string','undefined']],x.args);
		let attrName=x.args[0]
			,trueValue=x.args.length==2 ? x.args[1] : x.value
			,c=test2.call(this,x)
		;
		if(c.test){
			this._log.trace(`Setting attr '${attrName}'='${trueValue}' on node:`,x.node,c.logstr);
			x.node.setAttribute(attrName,trueValue); 
		}else{
			this._log.trace(`Removing attr '${attrName}' from node:`,x.node,c.logstr);
			x.node.removeAttribute(attrName); 
		}
		return;
	}


	/*
	* Set text at begining of node without affecting child nodes, optionaly formatting it first
	*
	* @param object x 		
	*  @prop node 
	*  @prop string|number value
	*  @opt string|function format|args[0] 	A live function or a '.' delimited string used to look on
	*										 'this' and window
	*
	* @return void
	* @call(xxx instance) 	//Used for logging and to look for $format functions
	*/
	function setText(x){
		var format=x.format||x.args[0];
		if(format){
			if(typeof format=='function'){
				x.value=format(x.value);
			}else if(typeof format=='string'){
				let str=bu.formatString(format,x.value);
				if(str){
					x.value=str
				}else{
					try{
						let address=format.split('.');
						format=bu.nestedGet(this||window,address)||bu.nestedGet(window,address);
						x.value=format(x.value);
					}catch(err){
						getLog(this).warn("Bad 'format' arg",format);
					}
				}
			}else{
				getLog(this).makeTypeError("'format' arg to be function or string",format)
					.changeLvl('warn').exec();
			}
		}

		bu.setFirstTextNode(x.node,x.value);
		return;
	}






























	/*
	* Prepare an xxx instance to use actions and register some basic actions. 
	*
	* NOTE: This method should be called from xxx constructors
	* NOTE2: If you call this method, you probably also want to set registerActionHandler() on the classes prototype
	*
	* @param @opt array includeExclude 		Array of action names. If the first item is ! the list is of those
	*										to ignore, else those to include
	*
	* @return void
	* @call(xxx instance)
	*/
	function setupActions(includeExclude){
		
		this._private.actions={}


		if(Array.isArray(includeExclude)){
			if(includeExclude[0]=='!')
				var exclude=includeExclude.slice(1);
			else
				var include=includeExclude;
		}

		var register=(name, func)=>{
			if((include && include.indexOf(name)==-1)||exclude && exclude.indexOf(name)>=-1)
				return;
			else
				registerActionHandler.call(this,name,func,true);				
		}

		register('hide',setDisplay.bind(this,false));
		register('show',setDisplay.bind(this,true));
		register('id',(x)=>x.node.id=x.value);
		register('class',followClass.bind(this));
		register('classif',toggleClass.bind(this));
		register('prop',followProp.bind(this)); 
		register('propif',toggleProp.bind(this)); 
		register('attr',setAttribute.bind(this));
		register('value',(x)=>{bu.setValueOnElem(x.node,x.value)});   //set value or checked attribute of node (or html if not input)
		register('html',(x)=>{x.node.innerHTML=x.value});				//set innerHTML without checking anything
		register('text',setText.bind(this)); 							//set text at begining of node without affecting child nodes
		register('showtext',(x)=>{ 
			setText(x);
			setDisplay.call(this,true,x);
		});
		register('onclick',(x)=>{
			if(typeof x.value=='function'){
				x.node.onclick=x.value;
			}else{
				let address=x.value.split('.');
				let func=address.length==1 ? this[x.value] : bu.nestedGet(this,address);
				if(func && typeof func=='function'){
					x.node.onclick=func;
				}else{
					x.node.setAttribute('onclick',x.value);
				}
			}
		});

	}

	/*
	* Add new actions/capabilities to xxx instance.
	*
	* @param string name 		String name of action. Will be converted to lower case and can then be invoked by attributes, eg: xxx-bind-nameoffunction
	* @param function func 		Will be called with: (this,{node, key, value, args:[],...any other props set on ^attr)
	*
	* @throws TypeError
	*
	* @return void
	*
	* @call(xxx instance) 		Set on proto.prototype^
	*/
	function registerActionHandler(name, func, silent=false){

		bu.checkTypes(['string','function'],[name,func]);
		name=name.toLowerCase();
		var a=this._private.actions
		if(a.hasOwnProperty(name)){
			a[name].push(func);
			if(!silent) this._log.debug(`Chained function to action '${name}'. Total funcs: ${a[name].length}`);
		}else{
			a[name]=[func];
			if(!silent) this._log.debug(`Registered action '${name}'.`);
		}

		return;
	}




	/*
	* Compare a value to another value. (this method is usually called from executeAction)
	*
	* @param object 	x			The object passed to the action function 
	*   @prop any 		 value 		  The value to check. If this is the only arg passed then @see bu.isEmpty($value,'*')
	*   @prop array 	 test	
	* 	  @arg string 	  operator 	    @see bu.compare(), the operator used to compare $value to $compareTo
	* 	  @arg prim 	  compareTo 	@see bu.compare()
	* 	  @opt prim 	  endOfRange 	@see bu.compare(). Only comes into play if $operator=='between'
	*
	* @return Object 				{test:bool, logstr:string} 	
	* @call(<xxx>)
	*/
	function test1(x){
		var obj={test:bu.compare(x.value,x.test[0],x.test[1],x.test[2])};
			if(this._log.options.lowestLvl<3){
				obj.logstr=(obj.test ? '<not> ':'')+bu.logVar(x.value)+x.test[0]+bu.logVar(x.test[1])
				+(x.test[2]==undefined ? '' : ` ${String(x.test[2])}`)//will only be the case on 'between'
		}
		return obj;
	}


	/*
	* Check if a test has already been performed, or if the underlying value is empty
	*
	* @prop object 	x 	The object passed to the action function, which may or may not have the prop .test already set
	*
	* @return Object 				{test:bool, logstr:string} 	
	* @call(<xxx>)
	*/
	function test2(x){
		if(x && x.test && x.test.hasOwnProperty('test'))
			return x.test;
		else{
			var obj={test:!bu.isEmpty(x.value,'*')} //'*'=> zero, null and false are considered empty
			if(this._log.options.lowestLvl<3){
				obj.logstr=bu.logVar(x.value)
				obj.logstr=(obj.test ? '<not empty> ' : '<empty> ')+obj.logstr
			}
			return obj;
		}
	}


	/*
	* Apply a pattern to a value. This can be used to combine different pieces of information.
	*
	* @param string|number key 		The Repeater index or the Binder key. Type is not checked but may be converted to primitive.
	* @param any value 				The value of the Repeater/Binder at that $key
	* @param string pattern 		A pattern like "#-${me.age}${foo}banan#hat"
	* @opt any node 				USED ONLY FOR LOGGING/EASY DEBUGGING
	*
	* @throw <ble TypeError> 		If $pattern isn't a string 
	* @throw <ble EMISSMATCH> 		If $pattern contains ${foo} when value is not complex
	*
	* @return any|primitive 		If $pattern == '$' or '#' than anything can be returned, else a primitive is guaranteed
	* @call(<xxx instance>) 		For logging purposes only
	*/
	function applyPattern(key,value,pattern,node=undefined){

		var log=getLog(this);

		//Start with 2 situations where any value can be returned, including undefined
		if(pattern=='$'){
			log.trace("Pattern '$', using original value:",value,node);
			return value;
		}
		if(pattern=='#'){
			log.trace("Pattern '#', using key only:",key,node);
			return key;
		}

		//Ok, from this point on we WILL be returning a primitive. If we wanted a live sub-object passed to a function, 
		//then I'm afraid that function will just have to use '$' and find the prop itself


		bu.checkType('string',pattern);
		let onComplexPattern=(value===undefined||value===null?'empty':typeof value=='object'?'':'throw');

		//Let's say we have
		//	key=7 		value={foo:"bar",me:{age:4}}		pattern="#-${me.age}${foo}banan#hat"
		//First we split the pattern into components, 
		//	["#", "-", "${me.age}", "${foo}", "banan", "#", "hat"]
		//then we substitute each item, 
		//	[7, "-", 4, "bar", "banan", 7, "hat"]
		//and finally we combine them into a string
		//	"7-4barbanan7hat"
		var string=pattern.split(/(\$\{[^}]+\}|#|\$)/)
			.filter(part=>part) //remove any empty parts that may have formed
			.map(part=>{
				if(part=='$')
					return value; //WARN: this may include unexpected stuff into the resulting string, but a custom toString()
								  //	  method will sort that...
				if(part=='#')
					return key;

				let m=part.match(/\$\{([^}]+)\}/);
				if(m){
					if(onComplexPattern=='empty'){
						return '';
					}else if(onComplexPattern=='throw'){
						log.throwCode('EMISSMATCH',"Got complex pattern but primitive value.",{pattern,part,value});
					}
					
					let val=m[1].includes('.') ? bu.nestedGet(value,m[1].split('.')) : value[m[1]]
					//"undefined" is never going to be what we want in the middle of a string, so warn an use an empty one
					return ((val=='undefined'||val==undefined)? '' : val)
				}

				//If we're still running then this is not a dynamic part, just return it
				return part;
			}).join('')
		;

		//Now we have a string, but perhaps it's a representation of a primitive, eg. "false" which we want to
		//to be able to evaluate falsey
		var resolved=bu.stringToPrimitive(string)

		//Finally we want to log something. Since this method is also used to test which template should be used by
		//Repeater we can't well warn every time it produces an empty string since that will be most of the time, so
		//we've included a hidden 4th argument...
		if(resolved==='' && arguments[3]!='noWarn'){
			log.warn(`Resolved pattern to empty string:`,{pattern,value,key,node,'this':this});
		}else{
			log.trace(`Resolved pattern '${pattern}':`,[value, '=>',resolved],{node,'this':this});
		}

		//Now we want to log something
		return resolved;
	}




	/*
	* Apply an instruction to a node. 
	*
	* @param <HTMLElement> node
	* @param object inst 			The instructions stored on the node relevant to $event
	* @param object event 	 		The data emitted by the underlying smarty 
	*
	* NOTE:   An action can consist of 1 or more callbacks
	* NOTE 2: Callbacks will be called in the order they where registered
	* NOTE 3: The same object is passed to each callback, ie. any edits will be seen by the next one
	* NOTE 4: Throwing an error will prevent further callbacks. Throw the string 'abort' to exit without
	*         logging an error
	*
	* @return void
	*
	* @call(xxx instance) 			Set on proto.prototype^
	* @no_throw
	*/
	function executeAction(node, inst, event){
		try{
			if(this._private.actions.hasOwnProperty(inst.fn)){
				//The action gets called with a single object that contains the event, node 
				//and instruction, which is also de-linked from the passed in objects
				var x=Object.assign({},inst,{node},event);
					//^ NOTE: The event takes presidence, so if you have args with same name they will get lost
					//^ NOTE2: This live object gets passed to each chained func, so it can be altered...
				
				//If a pattern was given, apply it now to both new and old value
				if(x.pattern){
					x.value=applyPattern.call(this,x.key,x.value,x.pattern,node); //throws on bad pattern
					if(x.old!=undefined){
						x.old=applyPattern.call(this,x.key, x.old, x.pattern,node);
					}
				}

				//If testing was called for, do so now, replacing the test array with an object
				if(x.test){
		 			x.test=test1.call(this,x);
				}

				//Check if we're calling one or more functions. 
				var funcs=this._private.actions[inst.fn], msg=`Executing fn '${inst.fn}'`
				if(funcs.length>1){
					this._log.debug(`${msg} (${funcs.length} funcs):`,{funcs:funcs.map(f=>f.name),arg:x});
					funcs.forEach(f=>f.call(this,x)) 
						//^end the chain early by throwing. throw the string 'abort' to end without logging error
				}else{
					this._log.trace(`${msg}:`,x);
					funcs[0].call(this,x);
				}

			}else{
				throw `No handler for action '${String(inst.fn)}'`;
			}
		}catch(err){
			//Allow a way for action funcs to stop further processing without logging error
			if(err==='abort'){
				this._log.trace(`Aborted '${inst.fn}'`);
			}else{
				this._log.error('Failed to execute action.',err,node,inst)
			}
		}
	}










	/*
	* Check that a targetClass is not already in use, then register it on the appropriate
	* constructor's _instances Map
	*
	* @param string targetClass
	*
	* @call(xxx instance)
	*/
	function addInstance(targetClass){
		const log=getLog(this);
		try{
			bu.checkType('string',targetClass);
			if(targetClass=='undefined')
				throw "The string 'undefined' is not suitable as targetClass";
		}catch(err){
			log.throw(`Bad targetClass (arg#1), cannot setup xxx.${this.constructor.name}.`,err)
		}
		//Check with all xxx types if an instance has already been registered with this class
		var name;
		for(name in _export){
			let c=_export[name];
			if(c.hasOwnProperty('_instances') && c._instances.has(targetClass)){
				log.makeError(`A xxx.${c.name} with class ${targetClass} already exists`
					,c._instances.get(targetClass)).setCode('EEXIST').throw();
			}
		}
		
		//If still running, register it
		this.constructor._instances.set(targetClass,this);
	}


	/*
	* Common setup... see func body
	* @call(xxx instance)
	*/
	function setupPrivateLogEvents(targetClass,options){
		//Store options and targetClass on _private
		bu.checkType('object',options); //throw on fail
		Object.defineProperty(this,'_private',{enumerable:false,value:{targetClass}});
		this._private.options=Object.assign({},this.constructor._defaultOptions,options);


		//Setup log, using targetClass as print name as well
		Object.defineProperty(this,'_log',{enumerable:false,value:new dep.BetterLog(this,
			Object.assign({'name':targetClass},options))});
		

		//Inherit from dep.BetterEvents and set failed emits to log to our log
		dep.BetterEvents.call(this);
		Object.defineProperty(this._betterEvents,'onerror',{value:this._log.error});
	}




	var proto={
		//NOTE: This object should be assigned to the prototype of xxx.bind and xxx.repeat. All methods in it
		//		will then be callable as this.METHOD from inside each xxx instance, instead of xxx.METHOD.call(this)
		prototype:{
			registerActionHandler
			,executeAction
		}
		,static:{
			hideElement
			,showElement
			,setText
			,applyPattern
		}
		,getInstructions
		,setupActions
		,addInstance
		,setupPrivateLogEvents
		,getLog
	};




	//Now require the pieces of the framework and export them
	_export.Binder=proto.Binder=require('./xxx-bind.class.js')(dep,proto);
	_export.Navigator=require('./xxx-nav.class.js')(dep,proto);
	_export.Repeater=require('./xxx-repeat.class.js')(dep,proto);

	return _export;
}
	
//simpleSourceMap=
//simpleSourceMap2=
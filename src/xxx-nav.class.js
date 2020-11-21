//simpleSourceMap=/my_modules/xxx/xxx-nav.class.js
//simpleSourceMap2=/lib/xxx/xxx-nav.class.js
'use strict';
/*
* @component Navigator
* @part-of xxx-framework
* @description Navigators show and hide elements using various means like url hash. It uses "logic states", ie. HIGH 
*              and LOW instead of 'show' and 'hide'. If the 'mode' set on an element is 'inverse', then HIGH=hide 
*              whereas normally HIGH=show. 
* @author plundell
* @license Apache-2.0
* @note: This component is required by ./xxx.proto.js, you should not need to access it directly.
* @depends libbetter
* @depends ./xxx.proto.js
* @exports {function} Call this function with the dependencies to get the Navigator constructor
*
*
* TODO 2020-01-09: Change 'key' to 'key' so we don't confuse with element key
* TODO 2020-02-07: Add '!' to mean 'when all are low', ie. the opposite of '*' => when all are high
*/


module.exports=function exportNavigator(dep,proto){;

	const bu=dep.BetterUtil;

	/*
	* @param string targetClass
	* @opt object options
	*
	* @emit before(method, keys) 	The method that was called, and the keys it was called with
	* @emit after(changed keys) 	An array of keys that actually changed state (check with navigator for current state of each key)
	* @emit failed(key, desired state, nodelist) 	If propogation fails, a list of those nodes who's instructions failed
	*
	* @extends BetterEvents
	*/
	function Navigator(targetClass, options=undefined) {
		//Call parent constructor. This will make sure the targetClass is unique, setup inheritence to BetterEvents,
		//create this.log and this._private 
		proto.XXX.call(this,'Navigator','xxx-nav',...Array.from(arguments));


		//Register all default actions (devnote: called seperately because all classes may not wish to implement the same actions)
		proto.setupActions.call(this,['show','hide','classif']);



		//Use the targetClass in certain cases when other options have not been given
		this._private.options.highlightClass=this._private.options.highlightClass || targetClass+'_highlight';
		this._private.hashKey=(typeof this._private.options.hashRouter=='string' ? this._private.options.hashRouter : targetClass);


		this.registerActionHandler('highlight',
			(x)=>this.executeAction(x.node, {fn:'classif',args:[this._private.options.highlightClass]},{value:x.value}),'silent')

		
		// This action is useful when setting the title of a wrapper which shows something (like a popup wrapper). 
		this.registerActionHandler('title',(x)=>Navigator.setText.call(this,Object.assign(x,{value:this.getHighKeys().join(',')})),'silent');
		  // ProTip: If you use: xxx-nav-title="*" it won't get called each time you HIGH(), but it will get called
		  // each time highOnly() gets called... like when switching between tabs/pages...

	} //end of constructor
	Navigator.prototype=Object.create(proto.XXX.prototype)
	Object.defineProperty(Navigator.prototype, 'constructor', {value: Navigator});


	
	//Static class variables
	Object.assign(Navigator,proto.static);
	Object.defineProperties(Navigator,{
		_instances:{value:dep.BetterLog.BetterMap()}
		,_defaultOptions:{value:{
			showMultiple:false
			,alwaysShowOne:true
			,highlightClass:null //defaults to targetClass+'_highlight', see constructor
			,defaultHigh:null //default key to show
			,hashRouter:false //if truthy the url hash will be updated and followed by this navigator. If a string is passed,
							  //it will be used instead of the targetClass as the key in the hash querystring
			,useOnclickAttr:null //If this nav is globally accessible you can set this to that path to use 'onclick' attribute instead of property
			,asyncMode:false  //if true, calls to show/hide stuff will be async, allowing listeners to 'before' event to finish before proceeding
			,breakOnHide:false //unlike repeater and binder, if a node is hidden here we keep processing rules
		}}
	});
	




	/*
	* @param string key 	Optional. If given, only nodes with this key is returned
	*
	* @param undefined|string|array[string] 	key 		One or more key's to get, or omitted to get all
	*
	* @throw <ble> 				If .setup() hasn't been called yet
	* @throw <ble TypeError> 	@see getNavInstructions(). Should not happen since we're using native funcs to build 'all'
	*
	* @return array[<HTMLElement>,...]
	*/
	Navigator.prototype.getNodes=function(key){
		//Make sure it's setup before proceeding.
		if(!this._private.states){
			throw this.log.makeError("Navigator not setup yet, cannot interact with it");
		}

		//Get all elements with valid instructions on the page (parses any new instructions, ignores previously
		//parsed and failed)
		var nodes=this.nodes.toArray().filter(elem=>getNavInstructions.call(this,elem).length);

																		
		if(typeof key=='string')
			return nodes.filter(elem=>elem.xxxNav.hasOwnProperty(key));
		else if(Array.isArray(key))
			return nodes.filter(elem=>bu.anyArrayOverlap(key,Object.keys(elem.xxxNav)));
		else
			return nodes;
	}


	/*
	* @return object 	Keys are those of this._private.states, values are arrays of all nodes with 
	*					instructions for that key
	*
	* NOTE: The same elem can exist in multiple of the nested arrays
	* NOTE: This will include nodes maked with '*'
	*/
	Navigator.prototype.getNodesGroupedByKey=function(){
		var grouped={};
		this.getNodes().forEach(elem=>{
			elem.xxxNav.keys().forEach(key=>bu.pushToNestedArray(grouped,key,elem));
		})
		return grouped;
		
	}



	/*
	* Parse documents for connected nodes and return all keys
	*
	* @return array[string] 	
	*/
	Navigator.prototype.getKeys=function(){
		this.getNodes();
		return Object.keys(this._private.states);
	}


	/*
	* @return object[arrays] 	Keys are 'high' and 'low', values are arrays of keys that are high/low
	*/
	Navigator.getKeysByState=function(){
		var grouped=bu.groupKeysByValue(this._private.states);
		return {high:grouped.true, low:grouped.false};
	}


	/*
	* @return array[string] 	Array of all HIGH keys
	*/
	Navigator.prototype.getHighKeys=function(){
		//Since keys initiate with false, we don't have to check for new ones before getting a list of truthy ones
		return Object.entries(this._private.states).filter(keystate=>keystate[1]).map(keystate=>keystate[0]);
	}

	/*
	* @return array[string] 	Array of all LOW keys
	*/
	Navigator.prototype.getLowKeys=function(){
		//Unlike getHighKeys() we have to look for new keys that may initiate with false
		this.getNodes();
		return Object.entries(this._private.states).filter(keystate=>!keystate[1]).map(keystate=>keystate[0]);
	}



//2020-02-12: We always want to apply a state since we don't know if new elements have been added/tagged or
//			  if something went wrong last time... so this type of function shouldn't be used
	/*
	* Check if a given list of key's are exactly those high right now
	*
	* @return boolean 
	*/
	// Navigator.prototype.sameState=function(keyOrKeys){
	// 	var arr=bu.checkType(['string','array'],keyOrKeys)=='string' ? [keyOrKeys] : keyOrKeys;
	// 	var highs=this.getHighKeys(true);
	// 	return bu.sameArrayContents(highs,arr);
	// }






























	/*
	* Prepare all nodes connected to this navigator and show defaults
	*
	* @return this 
	*/
	Navigator.prototype.setup=function(states){
		//Start by setting the private flag. NOTE: that getNodes() relies on this ==true, else it'll throw
		if(this._private.states){
			this.log.warn("Already setup",this);
			return;
		}else{
			this.log.info("Setting up navigator "+this.targetClass,this);
			if(bu.checkType(['object','undefined'],states)=='object'){
				this._private.states=bu.objCreateFill(Object.keys(states),false);
			}else{
				this._private.states={};
			}

			//Special key '*' is true if any are high, or false if all are low
			Object.defineProperty(this._private.states,'*',{
				enumerable:false
				,get:()=>Object.keys(this._private.states).some(state=>state)
				,set:()=>{} //you cannot set it manually, but we don't want an error...
			})
		}


		var o=this._private.options;

		//If we're using the onclick attribute, make sure this navigator is reachable
		if(o.onclickAttr){
			try{
				bu.checkType('string',o.useOnclickAttr);
				if(bu.nestedGet(window,o.useOnclickAttr.split('.'))!=this)
					this.log.throwCode("EADDRESS","Could not access this navigator at "+o.useOnclickAttr)
			}catch(err){
				this.log.throwCode("EINVAL","Bad option useOnclickAttr.",err);
			}
		}


		//Now set the passed in or default state on all nodes. This will change the view for the first time.     **MOVE**
		//This will also parses the document for nodes
		if(states){
			this.highOnly(bu.groupKeysByValue(states)['true']);
		}else if(o.defaultHigh){
			this.highOnlyDefault();

		}else if(o.alwaysShowOne==true){
			o.defaultHigh=this.getKeys()[0];
			this.log.warn(`defaultHigh not set, but alwaysShowOne==true which forces us to use first `
				+`key found as default: ${o.defaultHigh}`);
			this.highOnlyDefault();

		}else{
			this.lowAll();
		}

		//If this nav is using hash...                                                                            **MOVE**
		if(o.hashRouter){
			this.setupHashRouter();
			//NOTE: This will immediately follow any hash set, ie. default^ may have moved us somewhere, and this may move us again
			//NOTE2: Since we've already moved to default^, if we don't move again now, the hash won't display anything for the default location
		}
			

		return this;
	}




	/*
	* Prepare a single element connected to this navigator, removing it from the navigator if it's no good
	*
	* @param <HTMLElement> elem
	*
	* @throw <ble TypeError> 		
	*
	* @return object 			Keys are keys, values are arrays of instructions for that key. Also has
	*							special methods 'keys' and 'values', as well as getter 'length'
	*
	* @call(this)
	*/
	function getNavInstructions(elem){
		// console.warn(elem)

		if(!elem.xxxNav){
			//Read instructions from the element and add some handling (like adding click listeners...)
			//NOTE: xxxNav may be empty, but we still store it so we don't check again
			elem.xxxNav=proto.getInstructions.call(this, elem, inst=>{

				//'link' is a psuedo-action which really implies 'open'...
				if(inst.fn=='link'){
					inst.fn='open'

					//...we also set a class to mark it as a link, so we can style it before and after being used
					elem.classList.add('xxx-nav_link'); 
				}

				//'open' and 'close' are special cases, they are not actions that affect the node, instead they
				//ad a onclick func that changes states on this Navigator (that in turn will trigger actions...)
				if(inst.fn=='open' || inst.fn=='close'){
					
					//Determine which method we'll be calling...
					var method=(inst.fn=='open'?'high':'low');
					if(inst.key=='*'){
						method+='All';
					}else{
						if(inst.args.includes('only')) //Remember, of .options.showMultiple==false, this has no effect
							method+='Only'
						else
							method=method.toUpperCase();
					}
					method+='_click'

					//Then set it either on the elem's prop or attribute
					if(this._private.options.useOnclickAttr){
						elem.setAttribute('onclick',this._private.options.useOnclickAttr+'.'+method
							+'(this'+(inst.key=='*'?'':`,"${inst.key}"`)+')');
					}else{
						elem.onclick=this[method].bind(this,elem,inst.key);
					}

					//Now return 'drop' since this shouldn't be treaded as an instruction by propogateToNodes().
					//But first add the no-action tag so we don't warn
					elem.setAttribute('xxx-nav_noaction','');
					return 'drop';
				}

			},'group');

			// console.log(elem,elem.xxxNav.keys());

			//Make sure all keys exist as a state on the private var and a getter on this instance
			elem.xxxNav.keys().forEach(key=>{
				if(!this._private.states.hasOwnProperty(key)){
					this._private.states[key]=false
					Object.defineProperty(this,key,{get:()=>this._private.states[key]});
				}
			})

		}

		return elem.xxxNav;
	}






	/*
	* Tell this navigator to start updating and following the uri hash
	*
	* NOTE: This also reads the current hash and follows it
	*
	* @return void
	*/
	Navigator.prototype.setupHashRouter=function(){
		if(this._private.followHash || this._private.setHash){
			this.log.note("Hash routing already running on this Navigator");
			return;
		}
		this.log.info("Starting hash routing...");

		try{
			//Define method to read the current hash and navigate accordingly (storing it will
			//allow us to remove it later if wanted)...
			var lastSetHash; //used to prevent loops
			this._private.readAndFollowHash=()=>{
				if(window.location.hash===lastSetHash){
					this.log.trace('We triggered this change ourselves, ignoring...');
					return; //prevent responding to your own change
				}

				var ourHash=bu.getHashKey(this._private.hashKey);
				if(!ourHash){
					this.log.trace("Hash changed but doesn't reference our navigator:",window.location.hash);
				// }else if(this.sameState(ourHash)){
				// 	this.log.trace("Hash changed, but we're already in right state:",ourHash);
				}else{
					//We should only be here if we're not already showing the correct stuff, to 
					//further avoid any loops
					this.log.trace("Hash changed, following our part:",ourHash);
					this.highOnly(ourHash);
				}
			}
			//... then trigger it right away to follow any initial hash
			this._private.readAndFollowHash();

			//... and then start listening for the hash to change. This event only fires if a change 
			//actually occurs, so no risk for loops
			window.addEventListener("hashchange", this._private.readAndFollowHash);



			//Then start listening for changes on the local object and set the hash accordingly (again 
			//we store it so we can remove later
			this._private.setHash=this.on('after',(changed)=>{
				//No need to waste the cpu cycles if nothing has changed
				if(changed.length){
					//Get high keys as array or string depending on option showMultiple
					var keys=this.getHighKeys(true); //true == discard star
					if(this._private.options.showMultiple==false){
						keys=keys[0];
						//^ will be undefined if no keys are selected... remember to check for that vv
					}
					if(!keys || !keys.length)
						keys=undefined;

					bu.setHashKey(this._private.hashKey,keys);
					lastSetHash=window.location.hash;
				}
			});

		}catch(err){
			this.log.error("BUGBUG",err);
			this.stopHashRouter();
		}

		return;
	}


	/*
	* Stop hash routing if setup (ie. no danger calling this whenever)
	*
	* @return void
	*/
	Navigator.prototype.stopHashRouter=function(){
		var wasRunning=false;
		
		if(this._private.setHash){
			try{
				this.off(this._private.setHash);
				wasRunning=true;
			}catch(err){
				this.log.error("BUGBUG",err);
			}
			delete this._private.setHash;
		}

		if(this._private.readAndFollowHash){
			try{
				window.removeEventListener("hashchange", this._private.readAndFollowHash);
				wasRunning=true;
			}catch(err){
				this.log.error("BUGBUG",err);
			}
			delete this._private.readAndFollowHash;
		}

		if(wasRunning){
			this.log.debug("Stopped hash routing on this Navigator");
		}else{
			this.log.note("Hash routing isn't running on this Navigator, nothing to stop");
		}

		return;
	}























	/*
	* Log and emit what's about to happen
	*
	* @param string which 	 	The function called
	* @param array 	keys	
	*
	* @emit 'before' ($which, $keys)
	*
	* @return object|Promise 			@see options.asyncMode. copy of this._private.states (star included)
	* @call(this)
	*/
	function beforeStateChange(which,keys){
		bu.checkTypes(['string','array'],arguments);
		this.log.makeEntry('info',which,keys.join(', ')).addOrigin().exec();
		
		var before=Object.assign({},this._private.states);
		before['*']=this._private.states['*'];

		var promise=this.emit('before',which,keys);                    
		if(this._private.options.asyncMode)
			return promise.then(before);
		else
			return before;

	}


	/*
	* Determine which states changes, then emit and return that array
	*
	* @param object before 	 	@see beforeStateChange
	*
	* @emit 'after' (array) 	Emits with array of string keys, those who's state changed
	*
	* @return array[string]|Promise 	@see options.asyncMode. Array of keys that changed state (star included if changed). 
	*                                    	NOTE: To see what they changed to you have to check with the navigator...
	* @call(this)
	*/
	function afterStateChange(before){
		var changed=[],key;
		for(key in this._private.states){
			if(this._private.states[key]!=before[key]){
				changed.push(key)
			}
		}
		var promise=this.emit('after',changed);
		if(this._private.options.asyncMode)
			return promise.then(changed);
		else
			return changed;

	}





	/*
	* Make sure we have an array or keys and that NO STAR is included since we handle that manually
	*
	* @param string|array[string...] keyOrKeys
	*
	* @return array
	*/
	function prepareKeyArray(keyOrKeys){
		//Make sure we have an array for same handling and so it can contain '*' as well
		var keys=bu.checkType(['string','array'],keyOrKeys)=='string' ? [keyOrKeys] : keyOrKeys;

		//Remove star
		let star=keys.indexOf('*')
		if(star>-1)
			keys.splice(star,1)

		return keys;
	}


	/*
	* Set an key to HIGH.  Respects option showMultiple
	*
	* @param mixed keyOrKeys 		@see makeHighArr()
	*
	* @return array
	*/
	Navigator.prototype.HIGH=function(keyOrKeys){

		//If we're only showing a single at a time, switch over to that method...
		if(this._private.options.showMultiple==false)
			return this.highOnly(keyOrKeys);
		
		//Make sure we have an array and that it doesn't include '*' which we handle manually
		var keys=prepareKeyArray(keyOrKeys);

		//To enable the optional asyncMode we wrap the following steps using runInSequence() 
		var before;
		return bu.runInSequence([
			()=>{before=beforeStateChange.call(this,'HIGH',keys);} //returns promise in asyncMode
			,()=>{
				//Set all these keys to high, regardless what they were since new nodes may have been 
				//introduced...
				var groupedNodes=this.getNodesGroupedByKey();
				keys.forEach(key=>propogateToNodes.call(this,key,true,groupedNodes[key]))

				if(groupedNodes.hasOwnProperty('*') && !keys.includes('*')) //don't do again if keys already contained '*'
					propogateToNodes.call(this,'*',true,groupedNodes['*']); //At least one is high, so set * to high
			}
			,()=>afterStateChange.call(this,before)
		])

	}



	/*
	* Show a single or multiple keys, hiding all others
	*
	* @param string|array keyOrKeys
	*
	* @return array[<HTMLElement>] 	Array of nodes that where changed
	*/
	Navigator.prototype.highOnly=function(keyOrKeys){
		//Make sure we have an array and that it doesn't include '*' which we handle manually
		var keys=prepareKeyArray(keyOrKeys);

		//In case we're only allowed to high one...
		if(this._private.options.showMultiple==false && keys.length>1){
			this.log.throw(`Cannot set multiple keys to high (since option showMultiple==false). Got:`,keys);
		}
		
		//To enable the optional asyncMode we wrap the following steps using runInSequence() 
		var before;
		return bu.runInSequence([
			//emit and store the before-state
			()=>{before=beforeStateChange.call(this,'highOnly',keys);} //returns promise in asyncMode

			,()=>{
				//Regardless which states are what, we're going to make sure that ALL ELEMENTS get the right state
				var key,groupedNodes=this.getNodesGroupedByKey();//also makes sure all nodes are parsed
				for(key in groupedNodes){
					if(key=='*')
						continue; //we do this guy after, else it'll go to false now which may make something blink

					//Determine if it should be high or not...
					let setHigh=keys.includes(key);
					//...then do it!
					propogateToNodes.call(this,key,setHigh,groupedNodes[key]); //pass in nodes so we don't search again...
				}

				if(groupedNodes.hasOwnProperty('*')) 
					propogateToNodes.call(this,'*',true,groupedNodes['*']); //At least one is high, so set * to high
			}

			//Now emit the changed keys (NOTE: this does not include any information about if any nodes actually
			//changed or if there were any failure applying stuff)
			,()=>afterStateChange.call(this,before)
		]);
	}


	/*
	* Show all elements. 
	*
	* @throw <BLE> 			If options showMultiple==false 
	* @return array 		@see this.HIGH()
	*/
	Navigator.prototype.highAll=function(){
		return this.HIGH(this.getKeys());
	}

	
	/*
	* @throw Error 		If no default exists
	* @return array 	@see this.highOnly()
	*/
	Navigator.prototype.highOnlyDefault=function(){
		if(this._private.options.defaultHigh)
			return this.highOnly(this._private.options.defaultHigh);
		else
			this.log.throw("No default elem set");
	}





	/*
	* Set one or more keys to LOW. If all keys are low after that, we'll also set special key '*' to LOW. 
	* Respects options defaultHigh and alwaysShowOne.
	*
	* @param string|array keyOrKeys		
	*
	* @throws Error 			If you're trying to hide the last element and options alwaysShowOne==true && defaultHigh==null
	* @return array[<elem>...] 	Array of elements that where hidden this time
	*/
	Navigator.prototype.LOW=function(keyOrKeys,...secret){
		var keys=prepareKeyArray(keyOrKeys)

		//Determine the change...
		var [highAfter,noEffect,changed] = bu.arrayDiff(this.getHighKeys(),keys);

		//If at least one must remain high, make sure we're not about to violate that
		if(this._private.options.alwaysShowOne && !highAfter.length){
			//Ok, so we are going to violate that... maybe it can be saved with the default?
			if(this._private.options.defaultHigh){
				return this.highOnly(this._private.options.defaultHigh)
			}else{
				this.log.throw("Cannot LOW last element(s) with options alwaysShowOne==true && defaultHigh==null",changed);
			}
		}

		var which=secret.includes('lowAll')?'lowAll':'LOW';
		
		//To enable the optional asyncMode we wrap the following steps using runInSequence() 
		var before;
		return bu.runInSequence([
			//emit and store the before-state
			()=>{before=beforeStateChange.call(this,which,keys);} //returns promise in asyncMode

			,()=>{
				var groupedNodes=this.getNodesGroupedByKey();
				keys.forEach(key=>propogateToNodes.call(this,key,false,groupedNodes[key]))

				//Now if none are high after, also make star LOW (unless secret flag is set)
				if(!highAfter.length && groupedNodes.hasOwnProperty('*') && !secret.includes('ignoreStar') )
					propogateToNodes.call(this,'*',false,groupedNodes['*']);
			}
			
			,()=>afterStateChange.call(this,before)
		]);
	}


	/*
	* Hide all elements
	* @throw <BLE> 			If options alwaysShowOne==true
	* @return array 		@see this.LOW()
	*/
	Navigator.prototype.lowAll=function(){
		if(this._private.options.alwaysShowOne==true)
			this.log.throw("LOWing all not permitted on this navigator, see option alwaysShowOne==true");
		
		let keys=this.getKeys();
		return this.LOW(keys);
	}


	//Now add a few "click" methods that can be attached to elements
	for(let method of ['HIGH','LOW','highAll','lowAll','highOnly','lowOnly']){
		Navigator.prototype[method+'_click']=async function(elem,key){
			try{
				//Tag the elem as 'used' (hads no effect by default, except @see '.xxx-nav_link.xxx-nav_used')
				elem.classList.add('xxx-nav_used');

				await this[method](key);
			}catch(err){
				this.log.error("BUGBUG: onclick failed. ",err);
			}
		}
	}
















	/*
	* Propogate the change to all elements bound to a specific key, keys or all nodes
	*
	* @param string 			key 		
	* @param boolean 			state 		
	* @param array|undefined 	nodes  		
	*
	* @return void
	*
	* @call(this)
	* @no_throw
	*/
	function propogateToNodes(key,state,nodes){
		try{
			let a=this._private.states[key]==state ? ['Ensuring','is','trace'] : ['Setting','to','debug'];
			this.log[a[2]](`${a[0]} key '${key}' ${a[1]} ${state?'HIGH':'LOW'}. Nodes:`,nodes);

			var failed=[],event={key, value:state}; 
			for(let node of nodes){
				let instructions=node.xxxNav[key];
				if(!instructions || !instructions.length){
					this.log.error("BUGBUG: Node doesn't have instructions but still got into propogateToNodes()",node);
				}else{
					let len=instructions.length, i=0;
					try{
						//Now loop through that array and apply each inst
						for(i;i<len;i++){
							this.executeAction(node,instructions[i],event);
						}
					}catch(err){
						if(err=='break'){
							if(len-1-i) // any left...
								this.log.debug("Received 'break' signal. Skipping remaining instructions for node:"
									,{ran:node.xxxRepeat.slice(0,i),skipped:node.xxxRepeat.slice(i)},node);

						}else{
							this.log.error('Unexpected error on instruction:',instructions[i],node,err)
							failed.push(nodes);
						}
					}
				}
			}

//TODO 2020-09-25: why does this work diff than binder/repeater?? why emit?
			//If any failed, emit an error with them
			if(failed.length)
				this.emit('failed',key,state,failed);

			//If all didn't fail, set the new state... (the failed ones we'll have to deal with seperately)
			if(!nodes.length|| failed.length!=nodes.length)
				this._private.states[key]=state;


			return;

		}catch(err){
			this.log.error("BUGBUG:",err,arguments)
		}
	}


	//Create a style for the link
	bu.createCSSRule('.xxx-nav_link','text-decoration: underline; color:blue;');
	bu.createCSSRule('.xxx-nav_link.xxx-nav_used','color:purple');
	bu.createCSSRule('.xxx-nav_link:hover','cursor:pointer;');





	
	return Navigator;
}//correct, we do NOT run this function here, see ./require_all.js
//simpleSourceMap=
//simpleSourceMap2=
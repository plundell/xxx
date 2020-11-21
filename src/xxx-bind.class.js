//simpleSourceMap=/my_modules/xxx/xxx-bind.class.js
//simpleSourceMap2=/lib/xxx/xxx-bind.class.js
'use strict';
/*
* @component Binder
* @part-of xxx-framework
* @description This component provides two-way databinding to the DOM. 
* @author plundell
* @license Apache-2.0
* @note: This component is required by ./xxx.proto.js, you should not need to access it directly.
* @depends libbetter
* @depends ./xxx.proto.js
* @depends smarties.Object
* @exports {function} Call this function with the dependencies to get the Binder constructor
*
* Details:
*   - <Binder> is a "shell" into which you connect a <SmartObject>
*	- Outputting to the DOM is done by listening to events on the underlying smarty
*	- Inputting from the DOM is done by listening to 'input' events on <body> (ie. you can affect how/when
*	  the binder receives input by intercepting these events before they reach <body>, which is eg. how
*	  Binder.throttle() works. 
*
*     NOTE: we're using input vs change events since 'change' usually doesn't fire until an input looses focus
*           which would not be real two-way binding. If do want this functionality you'll have to intercept the
*			'input' event and re-fire it when the elem looses focus		  
*     NOTE: events are only emitted by elements when they are changed by the user, NOT when they are changed
*           programatically via eg. a Binder, ie. loops cannot be created that way... however input can still
*           be lost, ctrl-f INPUT LOSS
*/
module.exports=function exportBinder(dep,proto){

	const bu=dep.BetterUtil;



	/*
	* @constructor Binder
	*
	* @param string targetClass 	A HTML class that identifies all elements connected to this binder
	* @opt object options  			Gets assigned over Binder.defaultOptions and smarties.Object.defaultOptions
	*
	* @emit 'input' (<Event>)
	* @emit Everything emitted by <SmartObject>
	*
	* @extends <SmartObject>
	*/
	function Binder(targetClass, options=undefined) {

		//Call parent constructor. This will make sure the targetClass is unique, setup inheritence to BetterEvents,
		//create this.log and this._private 
		proto.XXX.call(this,'Binder','xxx-bind',...Array.from(arguments));

		//Binder and Repeater differ from Navigator in that they use an underlying smart data source...
		proto.prepareForData.call(this,dep.Smarties.Object);

		//Register all default actions (devnote: called seperately because all classes may not wish to implement the same actions)
		proto.setupActions.call(this);
		
	} //end of constructor
	Binder.prototype=Object.create(proto.XXX.prototype);
	Object.assign(Binder.prototype,proto.BinderRepeaterPrototype)//add common methods
	Object.defineProperty(Binder.prototype, 'constructor', {value: Binder});


	//Static class variables
	Object.assign(Binder,proto.static);
	Object.defineProperties(Binder,{
		_instances:{value:dep.BetterLog.BetterMap()}
		,_defaultOptions:{value:{

			breakOnHide:true //if a node is hidden, no other instructions are processed

		}}
		,_staticOptions:{value:{ //DevNote: we use staticOptions since these are needed by static function Binder.setupTwoWayBinding()

			inputDebounce:100 //Don't update the value of inputs for this many ms after they've emitted 'input'. This prevents 
								   //loops that especially affect text inputs where you risk loosing the last typed characters if
								   //you're a fast enough typer on a slow enough system
		}}	
	});
	



	

	/*
	* This method can be called once to setup all Binders (ie. scrape for data and output default values), 
	* as well as 2-way binding.
	*
	*/
	Binder.init=bu.once(function initBinders(){
		Binder.showAll();

		Binder.setupTwoWayBinding();
		
		Binder.automaticallyBind();
	})
	



	//Since ^ can optionally be called but doesn't have to be, we check a few seconds after this file has
	//loaded and warn if it hasn't been, just so the dev knows he may be forgetting something
	setTimeout(function BinderInitCheck(){
		if(!Binder.setupTwoWayBinding._once){
			bu._log.note("You have not run Binder.setupTwoWayBinding() which means binding is only one way, ie. any changes"
				+" made by the user to DOM inputs won't affect the Binder (and will be overwritten if the Binder later changes");
		}

		if(!Binder.automaticallyBind._once){
			bu._log.note("You have not run Binder.automaticallyBind() which means current data won't be automatically"
				+" propogated to new nodes, instead you have to call .triggerUpdate(node) manually, or wait for the data to change")
		}
	},3000)







	/*
	* Parse as much info about an elem as possible and store it on the elem itself. This can save crucial ms 
	* when we want a responsive interface later
	*
	* @param <HTMLElement> elem
	*
	* @throws <ble TypeError>
	*
	* @return <Binder>|undefined 	The appropriate binder if one was found, else undefined
	*
	* @call(<Binder>|any) 	For logging purposes only
	*/
	Binder._parseElem=parseElem;
	function parseElem(elem){
		let binder=getBinder.call(this,elem); //TypeError

		if(binder){
			//If we got a binder that means elem.xxx.binder has been set
			Binder.getInstructions.call(this,elem); //may set empty, ie. you need to forgetElem() for this to change
			getKeyBoundToValue.call(this,elem); //may set empty, ie. you need to forgetElem() for this to change
		}

		return binder;
	}

	/*
	* Removes all 'shortcut'/'lookups' set on an elem, allowing everything to be parsed a-new. This
	* function should be called if you change instructions etc.
	*
	* @param <HTMLElement> elem
	*
	* @return void
	* @no-throw
	*/
	Binder._forgetElem=forgetElem;
	function forgetElem(elem){
		//DevNote: If you create another prop in some function, you should add it to this list
		if(elem.hasOwnProperty('xxx')){
			delete elem.xxx.binder
			delete elem.xxx.binderInstructions;
			delete elem.xxx.keyBoundToValue;
			delete elem.xxx.ignoreOnInputting;

			if(!Object.keys(elem).length)
				delete elem.xxx;
		}
	}


	/*
	* Get the <Binder>, if any, used on an elem
	*
	* NOTE: This function stores a reference to binder on the elem itself for future lookup speed.
	*		Use Binder._forgetElem() to remove this and other similar lookups.
	*
	* @param <HTMLElement> elem
	*
	* @throw <ble TypeError>
	*
	* @return <Binder>|undefined
	*/
	Binder._getBinder=getBinder;
	function getBinder(elem){
		bu.checkType('node',elem);

		//If we've already found the binder for this elem...
		if(elem.hasOwnProperty('xxx')&&elem.xxx.hasOwnProperty('binder'))
			return elem.xxx.binder;

		//...else we look through it's classes to see if we find it
		let cls=Array.from(elem.classList).find(cls=>Binder._instances.has(cls));
		if(cls){
			if(!elem.hasOwnProperty('xxx')) 
				elem.xxx={};

			return elem.xxx.binder=Binder._instances.get(cls);
		}

		return undefined;
	}



	/*
	* Get binder instructions for an elem, organized by the key/prop the instruction is bound to.
	*
	* NOTE: This function stores a reference to the live parsed instructions on the elem itself for 
	* 		future lookup speed. Use Binder._forgetElem() to remove this and other similar lookups.
	*
	* @param <HTMLElement> elem
	* @param @opt string key  	 If given, a concated array of instructions for that key and '*' is returned
	*							 instead of the whole instructions object. Possibly an empty array
	*
	* @throw <ble TypeError> 	If $elem isn't an element
	*
	* @return object 			An object where keys match keys for the underlying smart and  values 
	*							 are arrays of instructions. Possibly an empty object if no instructions 
	*							 are found. Also @see $key
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the elem isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder.getInstructions=getInstructions;
	function getInstructions(elem, key){
		
		//Sanity check and make sure elem.xxx is set
		if(getBinder(elem)!=this){ //TypeError
			throw new Error("Binder.getInstructions should be called as an instance of Binder, with an elem connected to that binder");
		}

		//If no live object exists on the elem...
		if(!elem.xxx.binderInstructions){
			//...parse instructions anew. This may return an empty objet, which is also good because that means we don't
			//have to check again next time
			elem.xxx.binderInstructions=proto.getInstructions.call(this,elem,'group');

			//Since the instructions changed we also re-check which key and instruction, if any, binds to the value 
			delete elem.xxx.keyBoundToValue;
			getKeyBoundToValue.call(this,elem);
		}

		if(typeof key=='string'){
			return (elem.xxx.binderInstructions[key]||[]).concat(elem.xxx.binderInstructions['*']||[]); //this also clones the array so we don't alter the orig
		}else{
			return elem.xxx.binderInstructions;
		}
	}




	/*
	* Find which key, if any, in a elem's instructions is bound to the nodes value. This is used to scrape
	* both inputs and outputs for data
	*
	* @param <HTMLElement> elem
	*
	* @throw <ble TypeError>  		Bubbles from Binder.getInstructions()
	*
	* @return string|null 			A key name or null if no key could be found
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the elem isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder._getKeyBoundToValue=getKeyBoundToValue;
	function getKeyBoundToValue(elem){
		try{
			//Sanity check and make sure elem.xxx is set
			if(getBinder(elem)!=this){
				throw new Error("Binder._getKeyBoundToValue should be called as an instance of Binder, with an elem connected to that binder");
			}

			if(!elem.xxx.keyBoundToValue){
				var key,inst,backup=null,instructions=Binder.getInstructions.call(this,elem);
				loops:
					for(key in instructions){
						for(inst of instructions[key]){
							if(inst.fn=='value'){
								break loops; //break loop without unsetting key vv
							}else if(inst.fn=='text' || inst.fn=='html'){
								backup=key; 
							}
						}
						key=undefined;
					}
				//------ end of loops

				//Regardless if we found anything, set this value so we don't check again until having called forgetElem()
				elem.xxx.ignoreOnInputting=inst
				elem.xxx.keyBoundToValue=key||backup
			}

			return elem.xxx.keyBoundToValue;

		}catch(err){
			(this.log||bu._log).makeError('Failed to identify key bound to value',elem,instructions,err).throw();
		}
	}




	/*
	* To provide 2-way binding we listen to 'input' events on the <body>. This function sets that up and
	* should be called once AFTER the body has been loaded
	*
	* ProTip: You can check if this has been run by checking Binder.setupTwoWayBinding.hasOwnProperty('_once')
	*/
	Binder.setupTwoWayBinding=bu.once(function setupTwoWayBinding(){
		
		/*
		  Listen for all 'input' events which are emitted on EVERY CHANGE, unlike the 'change' event
		  which usually fires on focusout.
		 
		  ProTip: for inputs which produce large quantities of input events in rapid succession it may 
		          be wise to throttle or debounce them at the source element instead of when the underlying
		          smarty outputs them, that way this handler gets less busy
		*/
		document.body.addEventListener('input',binderInputEventHandler,{passive:true, capture:false})
		
		/*
		  The above listener will be bombared with events and must be able to quickly sort out non-bound 
		  elems, which it does by looking for target.xxx.binder which is set by getBinder(). 

		  Also, to then handle the input the bind-instructions must first be parsed. 

		  To make sure both of these^ things are done we call parseElem() every time a new input is focused 
		  upon (an event that always preceeds 'input' events from that input). If it's not bound or has already
		  been parsed then it's a quick, no-effect, operation...
		*/
		document.body.addEventListener('focusin',function parseElemOnFocus(event){parseElem(event.target)});

		/* 
		  --INPUT LOSS--
		  While inputting quickly on a slow system, the 'input' events caught here^ may be slow to make it
		  all the way through the binder to .propogateToNodes() which could cause eg. the following scenario:
			- user types 'a'
			- binder starts processing 1st event {target.value:"a"}
			- user types 'b'
			- binder starts processing 2nd event {target.value:"ab"}
			- 1st event reaches .propogateToNodes() => target.value is set to "a"
			- user types 'c' 
			- binder starts processing event {target.value:"ac"}					<-- b is gone
			- 2nd event reaches .propogateToNodes() => target.value is set to "ab"  <-- b came back
			- 3nd event reaches .propogateToNodes() => target.value is set to "ac"  <-- b is gone again, forever...

		  and ultimately we've lost a 'b'. To prevent this we mark the input with attr 'inputting' while input
		  events are flowing in close succession (done by this vv func), and then we have .propogateToNodes()
		  look for this attribute and NOT run the instruction linked to the value of the input (see 
		  getKeyBoundToValue() which flags that instruction)
		*/
		bu.markInputting(Binder._staticOptions.inputDebounce);


	})


	/*
	* When new elems are added or classes changed, check if said elem is/was part of a binder and
	* update it accordingly. This is done using MutationObserver on <body>
	*
	* NOTE: This will make sure <body> has loaded before running, since that could drastically
	*		slow down load time because every single added elem would trigger MutationObserver
	*
	* @return void
	*/
	Binder.automaticallyBind=bu.once(function automaticallyBind(){
		const log=proto.getLogAndOptions().log;
		//Make sure body has loaded, else warn and run again in 1s
		if(!document.body){
			log.warn("Called too early, running again in 1s");
			setTimeout(automaticallyBind,1000);
			return;
		}

		const observer = new MutationObserver(function findNewElemsToBind(records) {
			for(let record of records){
				if(record.type=='attributes'){
					//Figure out which classes where added or which were removed (both can happen in the name record)
					let curr=record.target.className.split(' ')
						,old=(record.oldValue ? record.oldValue.split(' ') : [])
						,diff=bu.arrayDiff(curr,old,'noCheck'); //noCheck=>don't check type, we know they're arrays
					;
					
					if(diff[0].length){
						//Classes where added
						for(let cls of diff[0]){
							if(Binder._instances.has(cls)){
								//An existing elem has just been bound, update it!
								Binder._instances.get(cls).triggerUpdate(record.target);
							}
						}
					}
					if(diff[1].length){
						//classes where removed
						for(let cls of diff[1]){
							if(Binder._instances.has(cls)){
								//An existing elem is no longer bound, remove all traces of the binding so any functions
								//that only check for certain properties (and not the class, like binderInputHandler) know
								//the elem is no longer connected
								forgetElem(record.target);
							}
						}
					}

				}else if(record.addedNodes.length){ //implies type='childList'
					//^We only care about added nodes. If they're deleted they're already gone and forgotten (ie. we 
					// don't store a list of them anywhere, we fetch them every time we propogate an output)

					//While debugging we may wish to profile this
					if(log.options.lowestLvl<3){
						var start=bu.timerStart();
					}

					//Unlike with attributes^ where the target itself is the only elem of interest, and thus can only 
					//be linked to a single <Binder> at most, when elems are added they can contain children and any
					//of them can be bound to any <Binder> (ie. the same added parent can contain children bound to 
					//different <Binder>s
					let i=0;
					for(let node of record.addedNodes){
						var classes=Array.from(Binder._instances.keys());
						if(bu.nodeType(node)=='element'){ //ignore 'text', 'comment' and 'attribute' nodes
							Object.entries(bu.multiQuerySelector(node,classes,'group','self','class'))
								.forEach(([cls,nodes])=>{
									if(nodes.length){
										Binder._instances.get(cls).triggerUpdate(node);
										i++
									}
								}
							)
						}
					}

					if(log.options.lowestLvl<3){
						log.debug(`It took ${bu.timerStop(start,'micro')} \u00B5s to match ${i} Binders`);
					}

				}
			}
		})
		Object.defineProperty(Binder.automaticallyBind,'observer',{value:observer});
		  //^make accessible in case we want to cancel it later for some reason


		
		observer.observe(document.body, {
		  	//Watch for the targetClass being added/removed from an elem, running parseElem()+triggerUpdate() 
		  	//or forgetElem()
		  	attributes: true
		  	,attributeFilter: ['class']
  			,attributeOldValue: true

  			//Watch for elements being added (then we can check for targetClass and run parseElem()+triggerUpdate())
  			,childList: true 		

  			//Watch the entire DOM
			,subtree: true
			
		})

	})


	













	/*
	* @param <Event> event 		A DOM 'input' event dispatched from ANY input (we check if it's meant for
	*							a Binder inside this handler)
	*/
	function binderInputEventHandler(event){
		//Check that the input comes from a bound target, and that we're not currently ignoring said input
		if(event.target.hasOwnProperty('xxx') && event.target.xxx.binder && !event.target.hasAttribute('xxx-bind_ignore')){
			//Only proceed if the binder currently has a data smarty connected...
			let binder=event.target.xxx.binder;
			if(binder.hasData()){
				//Find the key that solves (elem.value == self[key]). Since this is an input and a user has
				//actually changed it it's highly likely that we find one... but if we don't we log and exit
				let key=getKeyBoundToValue.call(binder,event.target);
				if(key==undefined){
					binder._log.warn("Couldn't find a key on input bound to this Binder.",elem,binder);
					return;
				}


				//Get the value from the input depending on "type"
				let value = (event.target.type == 'checkbox' ? event.target.checked : event.target.value)
			

				//Then set the value on the underlying smarty
				binder.set(key,value,{target:event.target,src:'input'});
				//ProTip: if the input changes rapidly/frequently and all intermittent values are NOT of interest
				//        you can either: a) throttle the events being emitted by the input, and/or b) use the 
				//        'throttle' or 'debounce' options of the underlying Smarty to affect the events being emitted
				//		  by it and handled by dataEventCallback() here
			}

			//Extra... Necessary?? Emit the original input-event on the binder
			binder.emit('input',event);
		}
	}




	/*
	* Event handler for smarties.Object's '_event'. 
	* @call(<Binder>)
	*/
	Binder.dataEventCallback=function dataEventCallback(event){
		//sanity check for bug that happened at some point... can delete in future
		if(typeof event.key=='object' && event.key.isSmart){
			this.log.throwCode(`BUGBUG`,`Binder got an event who's key was a ${event.key.isSmart}:`,event);
		}
		let ignoreMsg=`Ignoring <${event.evt}> event for key '${event.key}'`;
		//Quick check to see if any nodes are connected at all
		if(!this.nodes.length){
			this.log.trace(ignoreMsg+" because no nodes are connected to this binder.");
		}else{
			//Get all nodes connected to the key
			// this.log.highlight('blue',"Getting all nodes connected to key of this event:",event,event.key);
			var nodes=getNodeArray.call(this,event.key);
			
			if(nodes.length){
				propogateToNodes.call(this,nodes,event);
			
			}else if(this.log.options.lowestLvl<3){
				this.log.last().addHandling(ignoreMsg);
					//^The last entry on our log will be the 'no nodes connected to this binder' created by getNodeArray()
			}

		}
	}

























	Binder.prototype.show=function(data){

		//Make sure we have a data source
		proto.createReplaceOrVerifyDataExists.call(this,data);
		 //^ see func body... throws if not in the right sequence

		if(this.isShowing()){
			this.log.debug("Binder already showing...",this);

		}else{
			this.log.info("Showing binder with data:",this.data); //DON'T remove, this also works as a check if we've connected data

			//Before outputting anything, scrape for any data so we can save it for intentional later use and/or
			//so we can warn that you might have forgot to call .scrape('assign')
			if(!this._private.scraped && !bu.isEmpty(this.scrape('return'))){
				this.log.warn("Data was present in the DOM but will be either a) ignored if the key doesn't exist in this Binder, "
					+"or b) overwritten by the value in this Binder."
					,{inDom:this._private.scraped,inBinder:this.copy(),nodes:this.nodes.toArray()});
			}

			//Start listening to the smarty so we can propogate changes to dom
			proto.listenToData.call(this);

			//If any nodes are already in the DOM, output to them
			if(this.nodes.length)
				this.triggerUpdate();
		}
	}


	/*
	* Show all hidden binders with data, logging errors but continuing.
	*
	* @return void
	* @no-throw
	* @static 
	*/
	Binder.showAll=function showAll(){
		var ble=proto.log.makeEntry('info',"Showed all hidden Binders with data...");
		Binder._instances.forEach(binder=>{
			try{
				if(!binder.hasData()){
					ble.addHandling("No data connected: "+binder.targetClass);
				}else if(binder.isShowing()){
					ble.addHandling("Already showing: "+binder.targetClass);
				}else{
					binder.show(); //This will also parse all elements.
					if(binder.nodes.toArray().length)
						ble.addHandling("Showed: "+binder.targetClass);
					else
						ble.addHandling("Showed (but no bound elements yet): "+binder.targetClass);
				}
			}catch(err){
				err=proto.log.makeError("Unexpected problem showing binder:",binder,err).setCode('BUGBUG').exec();
				ble.addHandling(`Failed. See log #${err.id}: ${binder.targetClass}`);
			}
		})
		ble.exec();
		return;
	}



	Binder.prototype.hide=function(){
		if(this.isShowing()){

			proto.stopListeningToData.call(this);
			

			//Delete data so we scrape again next time we show
			delete this._private.scraped;

			//"empty" everything this binder did in the DOM. This is important if we're changing data sources since 
			//the new source may not contain the same keys as the old and as such those instructions won't run again 
			//and we'll have data orphaned in the DOM
			this.triggerUpdate(undefined,'delete');

		}else{
			this.log.debug("Binder already hidden...",this);
		}
	}







































	/*
	* Scrape for data on all nodes connected to this binder. The scraped data will be stored on this._private.scraped
	*
	* @param string whatToDo 	Accepted values:
	*								'assign' --> default. assigns the scraped data and returns <Binder>
	*                               'return' --> returns the scraped data without assigning it
	*
	* @return object|<Binder>
	*/
	Binder.prototype.scrape=function(whatToDo='assign'){
		if(whatToDo!='assign'&&whatToDo!='return')
			this.log.throwCode("EINVAL","Expected 'assign' or 'return', got:",whatToDo);

		this.log.trace("Scraping DOM for values...");

		//First get all the data...
		var data={};
		for(let node of this.nodes){

			let key=getKeyBoundToValue.call(this,node);
			if(!key)
				return;

			let value=bu.getValueFromElem(node);
			if(value===undefined || value==='')
				return;

			if(data.hasOwnProperty(key) && data[key]!=value)
				this.log.warn(`Found different values for key '${key}' while scraping:`,{'discarding':data[key],'using':value})

			data[key]=value;
		}

		//Store it for later access AND as a way to check if it's been done
		this._private.scraped=data;

		//...then decide what to do with it
		if(whatToDo=='return'){
			return data;
		}else{
			this.assign(data);
			return this;
		}
	}


	/*
	* Show all hidden binders with data, logging errors but continuing.
	*
	* @return void
	* @no-throw
	* @static
	*/
	Binder.scrapeAll=function scrapeAll(){
		var ble=proto.log.info("Scraped all hidden Binders with data...");
		Binder._instances.forEach(binder=>{
			try{
				if(!binder.hasData()){
					ble.addHandling("No data connected: "+binder.targetClass);
				}else if(binder.isShowing()){
					ble.addHandling("Already showing (scraping pointless): "+binder.targetClass);
				}else{
					if(binder.nodes.toArray().length){
						binder.scrape('assign');
						ble.addHandling("Scraped: "+binder.targetClass);
					}else{
						ble.addHandling("No outputs, nothing to scrape: "+binder.targetClass);
					}
				}
			}catch(err){
				err=proto.log.makeError("Unexpected problem scraping binder:",binder,err).setCode('BUGBUG').exec();
				ble.addHandling(`Failed. See log #${err.id}: ${binder.targetClass}`);
			}
		})
		ble.exec();
		return;
	}





	/*
	* Get an array of nodes, either a subset of those connected to this binder or all of them
	* 
	* @param mixed x 				See switch in function body
	*
	* NOTE: This function doesn't consider the "inputting" attribute, propogateToNodes() does that for the key bound 
	*		to the nodes value only (since we may eg. want a faulty value to set a class on the <input> in which case
	*		we can't ignore the <input> altogether ) 
	*
	* @return array 
	* @call(this)		
	*/
	function getNodeArray(x){
		//Step 1: get an array of nodes
		var nodes,msg;
		block:{
			let t=bu.checkType(['nodelist','array','node','string','undefined'],x);
			switch(t){
				case 'nodelist':
					x=Array.from(x);
				case 'array':
					nodes=x.filter(node=>node.classList.contains(this.targetClass)); 
					msg=`Got a list of ${x.length} nodes, ${nodes.length} were connected to this binder:`;
					break block;
				case 'node':
					nodes=bu.multiQuerySelector(x,this.targetClass,'self','class');
					msg=`Got a single node, ${nodes.length} of it's children were connected to this binder:`;
					break block;
			}
			//If we're still running that means x is a string or undefined...

			
			if(!this.nodes.length){
				//No need to log the same thing twice in a row... (which otherwise happens a lot, especially when 
				//using this.assign())
				if(this.log.options.lowestLvl<3){
					msg="No nodes connected to binder"
					let last=this.log.last();
					if(last.msg!=msg || last._age>1000){
						break block;
					}
				}
				return [];
			}else{
				switch(t){
					case 'undefined':
						msg="Nothing passed in, getting all nodes connected to this binder:";
						break block;


					case 'string':
						//a "key filter" passed in, ie. get nodes bound to a specific key of this binder
						msg=`Getting nodes bound to key '${x}':`;
						nodes=nodes.filter(node=>{
							var instructions=Binder.getInstructions.call(this,node); //only throws if node isn't a node
							return instructions.hasOwnProperty(x)||instructions.hasOwnProperty('*');
						});
						break block;

					default:
						this.log.throw('BUGBUG: util.checkType() returned unexpected value:',t);
				}
			}
		}
		var logargs=[msg,nodes,this];
		
		//Step 2: remove any we're ignoring
		var ignored=bu.extractItems(nodes,function(n,i,a){
			return n.hasAttribute('xxx-bind_ignore')
		});
		if(ignored.length){
			logargs.splice(2,"Ignored flagged elems:",ignored);
		}

		//We do it this way so so production nothing gets created at all... saving some cycles...
		this.log.trace(...logargs);
		

		return nodes;

	}







	/*
	* Go through an array of nodes, grouping them by key(s) they're bound to (ie. same node may appear in 
	* multiple arrays, @see @return)
	*
	* @param array|nodelist nodes 	Array of nodes
	*
	* @throw <ble TypeError> 	If $nodes is bad type
	* @throw <ble TypeError> 	If any item in $nodes isn't a node, bubbles from getBinderInstructions()
	*
	* @return object 	Keys match those on this.private.data, values are arrays of nodes bound to them 
	* @call(this) 		For logging purposes
	*/
	function splitNodesByKey(nodes){
		var obj={}; //init ret-obj
		bu.checkType(['array','nodelist'],nodes);
		var node;
		for(node of Array.from(nodes)){
			let instructions=Binder.getInstructions.call(this,node);
			Object.keys(instructions).forEach(key=>{
				//Add nodes to child-arrays on ret-obj for the given key
				if(obj.hasOwnProperty(key))
					obj[key].push(node)
				else
					obj[key]=[node];
			})
		}

		return obj;						
	}




	/*
	* Manually propogate values to all or a subset of nodes. This should normally not be needed externally 
	* unless:
	* 	1. you're changing ._private.data manually so no events are emitted by the underlying <SmartObject>
	* 	2. you're not using Binder.automaticallyBind() and then add an element to this binder
	*
	* @param mixed which 	@see getNodeArray
	* @opt string evt      'update' or 'delete'
	*
	* @return void;
	*/
	Binder.prototype.triggerUpdate=function(which,evt='update'){
		this.log.traceFunc(arguments);
		// console.warn("FORCED UPDATE",this)
		try{
			evt=evt=='delete'?'delete':'update';

			//First get the nodes we're going to update
			var nodes=getNodeArray.call(this,which);
			if(!nodes.length){
				which=which||'<all bound nodes>'
				if(evt=='empty')
					this.log.note("Trying to delete all binder data from DOM, but list of nodes is empty. Called on:",which);
				else
					this.log.warn("Trying to update an empty list of nodes, did this fire too soon? Called on:",which);
				return;
			}

			//Then split them by key (ie. keys on this._private.data)
			var groupedNodes=splitNodesByKey.call(this,nodes);
			

			//Then loop through said keys, fetching the value of it and propogating that value to the nodes
			this.log.debug(evt=='update'?'Manually updating:':'Removing data from DOM:',groupedNodes);
			// this.log.constructor.runAndInterceptLogs('triggerUpdate',()=>{
			for(let key in groupedNodes){
				try{
					let value=this.data.get(key);
					propogateToNodes.call(this,groupedNodes[key],{evt,key,src:"triggerUpdate",old:value,value:evt=='delete'?undefined:value});
					//DevNote: We're not emitting since that would run async...
				}catch(err){
					this.log.error(err);
				}
			}
			// },(entry)=>{})

		}catch(err){
			this.log.error(`Failed to manually run '${evt}' on:`,which,err);
		}
	}









	/*
	* Output the value of a certain key to nodes on the HTML page 
	*
	* @param array 			nodes 		An array of nodes bound to @key 	
	* @param object 		event 		Containing keys: evt, key, value, old
	*
	* @return void
	* @call(this)
	* @no_throw
	*/
	function propogateToNodes(nodes,event){
		this.log.traceFunc(arguments);
		//Get an object where keys are actions to take and values are node arrays
		for(let node of nodes){
			let i=0,instructions,len;
			try{
				//Get the instructions (as an array) for the key in question, and any marked with '*'
				instructions=Binder.getInstructions.call(this,node,event.key); //throws TypeError if not a node
				len=instructions.length
				if(!len){
					throw `No instructions for '${event.key}' or '*'`
				}else{
					//Now loop through that array and apply each inst
					for(i;i<len;i++){
						let inst=instructions[i];
						if(node.xxx.ignoreOnInputting===inst && node.hasAttribute('inputting')){
							this.log.note("Not outputting to currently receiving input.",inst,event, node);
						}else{
							this.executeAction(node,inst,event);
						}
					}
				}
			}catch(err){
				if(err=='break'){
				 	//any action callback can throw 'break' to stop all remaining instructions for this node
					if(len-1-i) // any left...
						this.log.debug("Received 'break' signal. Skipping remaining instructions for node:"
							,{ran:instructions.slice(0,i),skipped:instructions.slice(i)},node);
				}else{
					this.log.error(err,event,node)
				}
			}
		}

		return;
	}


	/*
	* Remove binding from one or more nodes
	*
	* @param <HTMLElement>|nodelist
	*
	* @return void
	*/
	Binder.prototype.unbind=function(nodes){
		Array.from(nodes).forEach(node=>{
			node.classList.remove(this.targetClass);
			forgetElem(node);
		//2020-03-30: Not necessary anymore
			// node.classList.remove(this._private.inputClass);

			// if(typeof node.xxxBindUnlisten=='function'){
			// 	node.xxxBindUnlisten();
			// 	delete node.xxxBindUnlisten;
			// }

		})

		return 
	}	
				




	return Binder;
}//correct, we do NOT run this function here, see ./require_all.js
//simpleSourceMap=
//simpleSourceMap2=
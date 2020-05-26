//simpleSourceMap=/my_modules/xxx/xxx-repeat.class.js
//simpleSourceMap2=/lib/xxx/xxx-repeat.class.js
'use strict';
/*
* @component Repeater
* @part-of xxx-framework
* @author plundell
* @license Apache-2.0
* @description Repeaters use standalone/underlying smarties.Array to repeat templates within a target element 
*              in the DOM. 
* @note: This component is required by ./xxx.proto.js, you should not need to access it directly.
* @depends libbetter
* @depends ./xxx.binder.js
* @depends ./xxx.proto.js
* @depends smarties.Array
* @exports {function} Call this function with the dependencies to get the Repeater constructor
*
* ProTip: If each clone is to contain mutiple pieces of data, then the value of the
*		  smarties.Array should be used to set classes/data-bind attributes on children of
*		  the clone for a seperate Binder to use
*
* DEPRECATED: If you see empty arrays / instructions it was the old way of preventing Repeater
*			  from warning when you intentionally wanted no actions. The new way is to use
* 				'{"x":"noaction"}'
*
* Terminology:
*  "Pattern":
*		Repeaters use pattern instead of regular keys in order for format the value passed to
*		action functions. The pattern can also make use of the index. Examples:
*			index=1, value='red', pattern='#' 			=> 	1
*			index=2, value='blue', pattern='$'			=>	'blue'	
*			index=3, value='green', pattern='#-$'		=>	'3-green'
*			index=4, value={foo:'bar'}, pattern='$'		=>	{foo:'bar'} 		*live object
*			index=4, value={foo:'bar'}, pattern='foo'	=>	'foo' 				*probably not what you want
*			index=4, value={foo:'bar'}, pattern='${foo}'=>	'bar'
*			index=4, value={foo:'bar'}, pattern='#$'	=>	"4{'foo':'bar'}"	*probably not what you want
*			index=6, value={foo:'bar',me:{age:30}}, pattern='#-${me.age}${foo}#hat'
*														=>	"6-15bar6hat"  
*/

//Export
module.exports=function exportRepeater(dep,proto){


	const Binder=proto.Binder
	const bu=dep.BetterUtil




	const blackhole=document.implementation.createHTMLDocument('blackhole');

	const TAG_RID='repeat-index-dependent';

	/*
	* @param string             targetClass
	* @param object             options 			@see defaultOptions
	* @param array|smarties.Array  data
	*
	*
	* NOTE: the template will not be removed from the html (unless it's inside the target which will always be emptied), so it 
	*		should be hidden or inside a template tag
	*
	* @extends BetterEvents	
	*/
	function Repeater(targetClass,options={},data=null){
		try{
			//Register this instance on Repeater._instances
			proto.addInstance.call(this,targetClass);
			
			proto.setupPrivateLogEvents.call(this,targetClass,options);

			
			/*
			* Create unique version of listener callback since we can share the underlying SmartArray but
			* may wish to manipulate this Repeaters listening status seperately
			*/
			this._private.dataEventCallback=dataEventCallback.bind(this)


			/*
			* @prop boolean indexDependentPatterns 	Patterns can use the index of an item ('#'). If any do (either the
			*										choice of template, or any of the template nodes) this flag needs  
			*										to bet set true which will cause a 'change' event to fire anytime 
			*										the order of the array is affected
			. This implies that anytime you alter the order of the array 
			*										(ie. anything other than adding/deleting the last item or merely 
			*										changing items in place) you have to run a 'change' event for ALL
			*										the affected indexes, which is slow, which is why we don't do it 
			*										unless we have to.
			* @private
			*/
			var indexDependentPatterns=false;
			Object.defineProperty(this._private,'indexDependentPatterns',{enumerable:true,
				get:()=>indexDependentPatterns
				,set:(str)=>{
					if(!indexDependentPatterns){
						if(str && this._private.options.debugMode){
							this._log.warn("Possible slowdown! By using patterns with '#', every time you alter the "
								+"order of items (ie. by adding/deleting/moving items in the middle) a 'change' event "
								+"will fire.");
						}
						indexDependentPatterns=str;
					}else if(indexDependentPatterns!=str){
						indexDependentPatterns='both';
					}

				}
			})

			/*
			* @property actions 	Holds callbacks which are invoked by instructions on html nodes
			*
			* NOTE: Actions work differently in Binder and Repeater. In Repeater:
			*   - Repeater WILL create/delete/move nodes
			*	- Repeater is NOT an instance of a smarty, but has (can share) an underlying smarty
			* 	- Repeater is connected to a specific target node (and replicates the smarty's children to that node)
			*   - When underlying smarty emits 'event', _private.dataEventCallback() is called. It in turn moves/removes
			*	   an item which doesn't require the action functions, OR it creates+calls action OR it calls action
			*
			* @access private
			*/
			proto.setupActions.call(this);

		//2020-04-01: Not necessary anymore, we watch for changes on <body> and auto-bind
			// //In case classes we apply mean a binder is in effect....
			// var possiblyUpdateBinder=(x)=>{
			// 	if(proto.Binder._instances.has(x.value)){
			// 		this._log.debug(`Repeater applied binder class (${x.value}), forcing binder update: `,x.node);
			// 		Binder._instances.get(x.value).forceUpdate(x.node);

			// 	}else if(x.old && proto.Binder._instances.has(x.old)){
			// 		this._log.debug(`Repeater removed binder class (${x.old}), unbinding: `,x.node);
			// 		proto.Binder._instances.get(x.old).unbind(x.node);
			// 	}

			// }
			// this.registerActionHandler('class',possiblyUpdateBinder,'silent');
			// this.registerActionHandler('classif',possiblyUpdateBinder,'silent');


			if(data){
				this._log.debug("Setting up data right away...")
				this.setupData(data);
			}

		}catch(err){
			console.error(typeof err, err.constructor.name,err);
			proto.getLog(this).throw('Failed to setup Repeater.',err,arguments);
		}
	}
	Repeater.prototype=Object.create(dep.BetterEvents.prototype)
	Object.assign(Repeater.prototype,proto.prototype); //add common methods
	Object.defineProperty(Repeater.prototype, 'constructor', {value: Repeater});

	
	//Static class variables
	Object.assign(Repeater,proto.static);
	Object.defineProperties(Repeater,{
		_baseAttr:{value:'xxx-repeat'}
		,_instances:{value:dep.BetterLog.BetterMap()}
		,_defaultOptions:{value:{
			children:'complex'//used by smarties.Array created here
			,moveEvent:true //used by smarties.Array created here
			,addGetters:true //used locally and by smarties.Array created here
			,target:null
			,template:`<span xxx-repeat='[{"value":"#"}]'></span>`
			,debugMode:true //Attributes will be left/added to nodes for debug clarity
		}}
	});







	/*
	* @call(this)
	*/
	// function storeInstance(name, removeOld=false){
	// 	//If we're changing names, remove the old entry
	// 	if(removeOld)
	// 		delete Repeater._instances[this._private.options.name];

	// 	//Now add the new entry
	// 	this._private.options.name=bu.getUniqueString(name,Object.keys(Repeater._instances));
	// 	Repeater._instances[this._private.options.name]=this;

	// 	//Lastly, change the name used for logging
	// 	if(this._log.options.name!=this._private.options.name){
	// 		this._log.debug(`Changing logging name to '${this._private.options.name}'`);
	// 		this._log.options.name=this._private.options.name;
	// 	}

	// 	return;
	// }


	Object.defineProperty(Repeater.prototype, 'length', {get: function(){
		if(bu.varType(this._target)=='node')
			return this._target.childElementCount;
		else
			return 0;
	}}); 


	/*
	* Check if Repeater is setup
	*
	* @return bool
	*/
	Repeater.prototype.isSetup=function(){
		if(typeof this._data=='object' //gets set by setupData()
			  && this._data.hasListener('event',this._private.dataEventCallback) //gets set by setup()
		){
			//We should be setup now, but it may be that the target has been removed from the DOM, so we check and
			//make sure to destroy if that's the case
			if(bu.varType(this._target)!='node'||this._target.ownerDocument!=document){
				this._log.warn("Target no longer valid",this._target,this); 
				// this._log.note("Target no longer valid, destroying...",this._target,this); 
				// this.destroy(true); //true=>destroy without checking if it's setup, which would cause infinite loop
				return false;
			}
			return true;
		}else 
			return false;
	}



	/*
	* Create/set smarties.Array on this._data
	*
	* @param <smarties.Array>|array|undefined 	data
	*
	* @throws Error,TypeError
	* @return this 				For chaining. The data was set on this._data
	*/
	Repeater.prototype.setupData=function(data){
		//Don't setup again if already setup...
		if(this.hasOwnProperty('_data')){
			if(data==undefined)
				return this._data;
			else
				this._log.throw("Data already setup on this repeater");
		}

		var sArr;
		switch(bu.varType(data)){
			case 'undefined': //implies data not setup, and nothing passed in
			case 'array':
				//Create new smarty...
				// this._log.note("Setting up new smarties.Array with options:",this._private.options);
				sArr=new dep.Smarties.Array(this._private.options);
				
				if(data){ //...and add all data to it
					sArr.concat(data);
					this._log.debug("Creating smartArray on repeater with data:",sArr)
				}else{
					this._log.note("Creating empty smartArray on repeater. Don't forget to populate it later!");
				}


				break;
			case 'object':
				if(data.isSmart=='SmartArray'){
					this._log.debug("Using passed in smartArray on repeater:",data);
					sArr=data;
					break;
				}

			default:
				this._log.throwType("array or smarties.Array",data)
		}
		Object.defineProperty(this,'_data',{value:sArr});

		//Extend the log of the smarties.Array to this 
		this._log.extend(sArr._log);

		return this;
	}





	/*
	* Shortcut to the underlying data
	*/
	Repeater.prototype.get=function get(key){
		if(this._private._data)
			return this._private._data.get(key);
		else
			return undefined;
	}


	/*
	* Shortcut to the underlying data
	*/
	Repeater.prototype.set=function set(key,value){
		if(this._private._data)
			return this._private._data.set(key,value);
		else
			return undefined;

	}


	/*
	* Get all nodes with instructions for this instance, based on if they have the targetClass set
	*
	* @opt <HTMLElement> parent 	Only look for nodes in this parent. 
	*
	* @return array[<HTMLElement>] 	The $parent may be included
	*/
	Repeater.prototype.getNodesWithInstructions=function(parent){
		parent=parent||this._target
		bu.checkType('node',parent);

		var nodes=Array.from(parent.getElementsByClassName(this._private.targetClass));
		if(parent && parent.classList.contains(this._private.targetClass)){
			nodes.push(parent);
		} 
		return nodes;
	}



	/*
	* Propogate all items on underlying smarties.Array to DOM
	*
	* NOTE: This function needs to be .call(this,...)
	*
	* @throws Error 	If target is not empty
	* @return array 	Array of newly created nodes
	* @call(this)
	*/
	function addAll(){
		if(this._target.childElementCount){
			this._log.throw("Target is not empty, cannot add items since it may create duplicates",this._target);
		}

		if(this._data.length){
			this._log.debug(`Going to add all ${this._data.length} items to target:`,this._target);
			var nodes=this._data._private.data.map((value,key)=>insertItem.call(this,{value,key,src:'addAll'}));
			  //^since there was no 'event' we skip the key 'evt' and 'old'
			this._log.trace("All items added",nodes);
			return nodes;
		}
	}


	/*
	* Add an item to the target
	*
	* @param object event
	*
	* @return node 		The newly created clone
	* @call(this)
	*/
	function insertItem(event){
		try{		
			//Start by cloning and preparing a template
			var clone=chooseAndCloneTemplate.call(this,event.key,event.value);
			var childrenWithInstructions=prepareClone.call(this,clone);
			let ble=this._log.makeEntry('debug',"Prepared new repeat item:")
				.addHandling('Children with instructions:',childrenWithInstructions)

			//Then fill the new clone with data
			propogateToNodes.call(this,clone,event)
			
			ble.addHandling('Data:',event).exec();
		}catch(err){
			var clone=document.createElement('span');
			this._log.error("Failed to get template. Substituting empty <span> to keep Repeater "
				+"in-sync with underlying data",err,clone,event);

			clone._checkRightTemplate=function(){return false;} //never the right template, which forces the repeater to try again
															//when data changes			
		}

		if(event.key==this.length){
			this._target.appendChild(clone);
		}else{
			this._target.insertBefore(clone, this._target.children[event.key]); //insert before the current child in that position
		}

		if(this._private.options.addGetters){
			//Regardless where the item was inserted, the total length has increased, so add a public getter
			let last=this._target.childElementCount-1
				,self=this
			;
			Object.defineProperty(this,last,{
				enumerable:true,configurable:true,get:function getRepeaterItem(){return self._target.children[last];}});
		}

		
		return clone;
	}

	/*
	* The following scenario used to create a bug:
	* 	Create repeater A
	* 		Create repeater B inside
	* 	Destroy repeater A
	* 	Create repeater A
	* 		Attempt to create repeater B --> fail
	* 
	* It may be because repeater B was not correctly destroyed, so this function checks if children are repeaters and 
	* destroys them before destroying the parent
	*
	* @param element elem
	* @return elem 			Same as passed in
	*/
	function gracefullyRemoveElement(elem){

		//First we need to find and destroy any nested Repeater. We want to destroy the deepest one first...
		var nodes=this.findNestedRepeaters(elem,true); //true=>only get setup children
		
		if(nodes.length){		
			this._log.debug(`Destroying ${nodes.length} nested repeaters before proceeding:`,nodes);
			nodes.forEach(node=>node._repeater.destroy());
			this._log.debug("Done destroying children, now removing this elem:",elem)
		}else{
			this._log.debug("No nested repeaters found, just removing this elem:",elem);
		}

		//Now we only have non-repeaters left. We may want to loop through them an delete each in turn in the
		//same way, but for now we're trying just to remove them all
		blackhole.adoptNode(elem);
		return elem
	}



	/*
	* Remove all items from target, even those not created by this repeater
	*
	* NOTE: This function needs to be .call(this,...)
	*
	* @return void
	*/
	function emptyTarget(){
		var total=this._target.childElementCount;
		this._log.debug(`Emptying target of all ${total} elements:`,this._target);

		if(this.length<total)
			this._log.warn("Additional elements in target detected, these will be removed as well");

		//Remove all children
		while(this._target.childElementCount){
			// this._target.removeChild(this._target.lastElementChild)
			gracefullyRemoveElement.call(this,this._target.lastElementChild); //2019-05-23: Trying to solve issue when re-adding nested repeaters
		}

		//Remove all public getters
		if(this._private.options.addGetters){
			var p,d;
			for(p of Object.getOwnPropertyNames(this)){
				try{
					d=Object.getOwnPropertyDescriptor(this,p);
					if(d.enumerable==true && typeof d.get=='function'){
						delete this[p];
					}
				}catch(err){
					this._log.error("Problems while deleting public getters. Current prop: "+p,err,d);
				}
			}
		}
	}







	













	/*
	* Remove all items from target, then add them back. Can be used if for some reason we're out of sync between
	* data and DOM items
	*
	* @return this
	*/
	Repeater.prototype.repopulateTarget=function(){
		emptyTarget.call(this);
		addAll.call(this);
		return this;
	}



	/*
	* Setup this repeater, ie. start propogating private data to DOM. Opposite of destroy() which removes all DOM data.
	* Think of these two methods as show and hide.
	*
	* NOTE: This method can be called multiple times if we call destroy() inbetween.
	* NOTE2: Template is only parsed on first call to this method
	*
	* @param 
	*
	* @return this
	*/
	Repeater.prototype.setup=function(data){
		//If data was passed in, either setup a 
		//Don't run twice
		if(!this.isSetup()){
			var opt=this._private.options;
			// this._log.info("Setting up repeater with options: ",opt,this);

			//First, create/set smarties.Array on self._data. If nothing is passed in
			// a) we're already setup so nothing happens
			// b) an empty smarties.Array is setup
			this.setupData(data)



			//On first call to setup(): parse/prepare the template. We do this after setting up data so we
			//can check what kind of children, and thus what kind of instructions we expect (bad instructions will be removed)
			if(!this._templates){
				Object.defineProperty(this,'_templates',{value:this.prepareTemplates()});
			}


			//On each setup make sure we have a live target in this document
			if(!this._target || this._target.ownerDocument!=document){
				let target=prepareTarget.call(this);
				Object.defineProperty(this,'_target',{configurable:true,value:target});
			}

			//If any data already existed (or was setup here), propogate it to DOM before listening for events. We
			//do this both to limit log, but also for same handling of existed before/setup here
			addAll.call(this);
			this._log.trace("Repeater should now be setup/visible");

			//Listen to data change events on self and propogate them to the DOM. This listener is
			//what determines if the repeater has been setup or not.
			this._data.on('event',this._private.dataEventCallback);

		//If new data is passed in, replace existing data which will propogate to DOM
		}else if(Array.isArray(data)){
			this._log.trace("Setting up with new data, old/new:",this._data.get(),data);
			this.replace(data);

		}else{
			this._log.warn("Repeater already setup, cannot do it again",this);
		}

		return this;
	}


	/*
	* The opposite of 'setup()', remove all items from the DOM (but keep the data/smarties.Array). This can be reversed 
	* again with 'setup()'
	*
	* @return this
	*/
	Repeater.prototype.destroy=function(force=false){		
		if(force||this.isSetup()){
			this._log.debug(`Going to stop listening to private data and empty target of elements.`,this);

			//Stop propogating changes to DOM
			this._data.removeListener(this._private.dataEventCallback,'event');

			//Remove any items from target. NOTE this may remove more than our nodes if someone has put stuff in
			//the target... that's a fail-safe so we can always continue
			emptyTarget.call(this);

		}else{
			this._log.warn("Repeater not setup, nothing to destroy",this);
		}

		return this;
	}




	/*
	* The function which .setup() will use to listen for the 'event' event on ._data. This func either moves
	* existing nodes around, or it creates new ones/alters existing ones
	*
	* NOTE: This func is bound to this instance by constructor and stored on ._private. That way each instance
	*		gets a unique version of it that can be identified and removed when multiple Reapeaters share the
	*		same underlying SmartArray
	*
	* @emit new(i,elem,data)
	* @emit delete(i,oldElem,oldData)
	* @emit change(i,elem,data,oldData)
	* @emit move(elem,to,from) 	
	*
	* @return void
	* @no-throw
	* @bind(this)
	*/
	function dataEventCallback(event){
		// evt,i,value,old,oldIndex
		try{

			this._log.traceFunc(arguments);

	//TODO 2020-04-01: We're allowing complex values, but we can't handle nested keys here... so just
	//					make sure we havn't got one
			if(isNaN(Number(event.key))){
				this._log.error("BUGBUG: Repeaters can't handle nested keys, we're only interested in "
					+"what happens with the local array");
				return;
			}

				
			var elem,indexesAffected

			//The 'new' event is the only where elem doesn't need to exist, so do that first...
			if(event.evt=='new'){
				elem=insertItem.call(this,event)
				
				//Get effected range AFTER adding
				let last=this.length-1;
				if(this._private.indexDependentPatterns && event.key<last){
					indexesAffected=bu.range(event.key+1,last);
				}

			}else{
				elem=this._target.children[event.key]
				//...for all the rest it must, so check
				if(bu.varType(elem)!='node'){
					this._log.error("Child #"+event.key+" does not exist, cannot propogate event: "+event.evt);
					return;
				}

				switch(event.evt){
					case 'indexChange':
						// This case is almost a copy of 'change'v

						//We use the .indexDependentPatterns prop to make sure we're not checking unecessarily 
						//where we KNOW patterns don't contain '#'
						if(this._private.indexDependentPatterns!='i' && !elem._checkRightTemplate(value)){
							gracefullyRemoveElement.call(this,elem);
							elem=insertItem.call(this,event);
							this._log.debug("Changed templates for elem #"+event.key,elem);
						}else if(this._private.indexDependentPatterns!='t' && elem.hasAttribute(TAG_RID)){
							propogateToNodes.call(this,elem,event,'onlyIndexPatterns')
						}else{
							this._log.trace("Ignoring elem without index dependent pattern.",event,elem)
						}
						break;

					case 'change': 
						if(!elem._checkRightTemplate(event.value)){
							// this._target.removeChild(elem);		
							gracefullyRemoveElement.call(this,elem);
							elem=insertItem.call(this,event);
							this._log.debug("Changed templates for elem #"+event.key,elem);
						}else{
							propogateToNodes.call(this,elem,event)
						}
						// this.doubleEmit('nodeChange',elem,value,oldValue);
						break;

					case 'delete':
					 	this._log.debug('Removing repeater elem #'+event.key,elem);

					 	//Get effected range BEFORE deleting
					 	let last=this.length-1;
					 	if(this._private.indexDependentPatterns && event.key<last){
					 		indexesAffected=bu.range(event.key,last);
					 	}

						// this._target.removeChild(elem);	
						gracefullyRemoveElement.call(this,elem); //2019-05-23: Trying to solve issue when re-adding nested repeaters

						if(this._private.options.addGetters){
							//It just got one shorter, so remove the last getter
							delete this[this.length];
						}
						break;

					case 'move':
						this._log.debug('Moving repeater elem #'+event.from+" to #"+event.to,elem);
						
						if(this._private.indexDependentPatterns){
							indexesAffected=[Math.min(event.from,event.to),Math.max(event.from,event.to)];
						}

						this._target.insertBefore(elem, this._target.children[event.to]);
						break;


					default:
						this._log.note('Unhandled event: '+event.evt);
				}
			}

			//If we affected any indexes...
			if(indexesAffected){
				// ...just call this same method again saying that index has changed. It's not the fastest way of doing it,
				//but at least it works
		//TODO 2020-04-01: Make sure this is correct...
				indexesAffected.forEach(key=>dataEventCallback.call(this,Object.assign({},event,{evt:'indexChange',key,old:event.value})))
					//^be clear that the old value hasn't changed
			}

			//Kindof propogate the event from the underlying smarty...
			event.target=elem
			this.emit(event.evt,event);
			
		
		}catch(err){
			this._log.error("BUGBUG",err,event);
		}
	}
















	/*
	* Find all nested repeaters in a given element (can be any element in the DOM)
	*
	* @param <HTMLelement>  elem 
	* @param bool 			onlySetup  	Default false. If true only child repeaters that have been setup are counted
	*
	* @return array(<Node>,...) 	Array of nodes, each having a ._repeater property. The deepest one first
	*/
	Repeater.prototype.findNestedRepeaters=function(elem,onlySetup=false){
		bu.checkType('node',elem)

		var	nodes=Array.from(elem.querySelectorAll('[repeater-target]'));

		if(nodes.length){
			//We want to return an array organized by depth (so eg. gracefullyRemoveElement() can remove them 
			//in the right order), so start by grouping them by such....
			var byDepth={},c=0;
			nodes.forEach(node=>{
				//Optionally check if setup...
				if(onlySetup && !node._repeater.isSetup()){
					return;
				}
				c++;
				let d=bu.countParentNodes(node);
				if(byDepth.hasOwnProperty(d))
					byDepth[d].push(node);
				else
					byDepth[d]=Array(node);
			})

			//...then flatten into an array
			nodes=[];
			var keys=Object.keys(byDepth).sort().reverse().forEach(key=>{
				nodes.push.apply(nodes,byDepth[key])
			})
		}

		return nodes;
	}

	Repeater.prototype.countNestedItems=function(onlySetup=false){
		var l=this.length,count=0;
		for(var i=0;i<l;i++){
			this.findNestedRepeaters(this[i],onlySetup).forEach(child=>count+=child.length);
		}
		return count;
	}


	Repeater.prototype.replace=function(arr){

		if(!this.hasOwnProperty('_data')){
			this._log.throw("Not data setup yet, cannot replace");
		}

		try{
			//Try replacing gracefully (ie. only apply changes...), but if anything goes wrong, stop trying right away
			//since the order is most likely messed up...
			var oldValues=this._data.get();
			this._data.replace(arr,'panic'); //panic==stop right away
		}catch(err){
			this._log.warn("Regular delete->event->propogate failed. Manually emptying DOM target and data.",err);
			//...and instead just replace everything
			emptyTarget.call(this);
			this._data._brutalEmpty(); //Just replace private data array with zero ado...
			this._data.concat(arr);
		}
		return oldValues;
	}


	Repeater.prototype.empty=function(){
		return this.replace([]);
	}






	/*
	* Prepare target (ie. where copies of the template will be inserted)
	*
	* NOTE: This method removes the template if it exists inside the target
	* 
	* @return <HTMLElement> 	The live target element
	*
	* @call(this)
	*/
	function prepareTarget(){
		this._log.traceFunc(arguments);
		try{
			var target,template;

			if(this._private.options.target){
				//If a specific target was specified in options, that takes presidence
				target = bu.getLiveElement(this._private.options.target,true); //true==return null if none found
				if(!target)
					throw this._log.makeError("Bad target (arg#2)",this._private.options.target);
				else
					this._log.debug("Using explicit target:",this._private.options.target)
			}else{
				//...else use the parent of the template
				try{
					template=bu.getLiveElement(this._private.options.template,false);//false==throw on not found
					target = template.parentNode 
					this._log.debug("Using templates' parent as target:",target)		
				}catch(err){
					this._log.debug("No explicit target specified, trying templates' parent");
					throw err;
				}
			}

			//Now make sure it's valid...
			if(target.ownerDocument!=document)
				this._log.throw("The target is not part of this document:",target);

			//Remove the template if it was inside the target
			let c=target.childElementCount;
			if(c>0){
				if(c>1||target.firstElementChild!=template)
					this._log.throw("Repeater targets must be empty.",{target,'liveTemplate':template,
					  'template':this._private.options.template,'Repeater':this});
				target.removeChild(template);
			}
			
			//...finally mark it with a flag which we use when checking for nested repeaters (and for debug clarity)
			target.setAttribute('repeater-target',this._private.targetClass);
			target._repeater=this;

			//...aaand set a ref on the node to this repeater (debug clarity only?)
			

			return target;

		}catch(err){
			this._log.throw("Failed to get target.",err);
		}
	}





	/*
	* Prepare all elements in a template(s) so it can be quickly copied and values inserted into it.
	*
	* NOTE: This method should be run AFTER setupData() so we know what kind of pattern to expect
	* NOTE2: This method can't prepare everything since we're cloning, so also see prepareClone()
	*
	* @return array 		Array of templates (cloned nodes)
	*/
	Repeater.prototype.prepareTemplates = function(){
		var template=bu.getLiveElement(this._private.options.template); //gets html node from node|id|htmlstring
		
		//Since multiple repeaters may be using the same template, we need our own copy, so clone it (or possibly them, see vv)
		var clones;
		if(template.tagName=='TEMPLATE'){
			//The <template> tag is a DocumentFragment, which means we have to get it's children which are the actual 
			//templates... children-->plural, which means there could be multiple templates...
			// clones=Array.from(template.content.children,child=>child.cloneNode(true));
			clones=Array.from(template.content.children,child=>document.importNode(child,true));//2019-02-08: adopt just in case...

		}else{
			// clones=[template.cloneNode(true)];
			clones=[document.importNode(template,true)]; //2019-02-08: true=>adopt...just in case...
		}

		
		//If we have multiple templates, we have to make sure they have ${'xxx-repeat'}-if attributes, since we'll 
		//only be inserting a single template for each item in the underlying smarties.Array. So any that are missing 
		//this attr, delete
		if(clones.length>1){
			for(var i=clones.length-1;i>-1;i--){
				let c=clones[i];

				if(!c.hasAttribute('xxx-repeat_usedefault')){
					let attr='xxx-repeat_useif'
					if(!c.hasAttribute(attr)){
						this._log.warn(`Removing one of multiple templates because it's missing useif/usedefault attributes:`,c); 
						clones.splice(i,1);
						continue;
					}else{
						try{
							var rule=c.getAttribute(attr);
							rule=bu.tryJsonParse(rule, true) || [rule]; 
					
							if(rule.length==1){
								//if a single value was given ^, then it was the criteria, so we add pattern and operator
								rule.unshift('$','==');
							// }else if(c.getAttribute(rule[0]).includes('#')){  //2020-05-19: <-- that's just wrong, right?
							}else if(rule[0].includes('#')){
								this._private.indexDependentPatterns='t';  

	//TODO: keep seperate track if template-choice is '#'
								this._log.warn("Slow template chooser:",rule);
							}

							//now re-save the full rule
							c.setAttribute(attr,JSON.stringify(rule));

						}catch(err){
							this._log.error(`Removing bad template:`,c,rule,err); 
							clones.splice(i,1);
							continue;
						}
					}
				}
			}
		}

		if(clones.length>1){	
			this._log.info(`Multiple templates (${clones.length}) found:`,clones);
		}else{
			this._log.debug('Single template found:',clones[0]);
		}
		
		//Now we want to do as much preparation as possible, so we don't have to do it each 
		//time in createItem(). So loop through all templates...
		clones.forEach((clone,i)=>{
			//...and all nodes in each template
			var allElems=Array.from(clone.getElementsByTagName("*"));
			allElems.push(clone); //include the clone itself
			var t=0
			allElems.forEach(elem=>{
				try{
					//We need to remove ids, but for debug purposes we'd like to still be able to 
					//see them, so move them to another attribute
					if(elem.hasAttribute('id')){
						elem.setAttribute('_id',elem.getAttribute('id'));
						elem.removeAttribute('id');
					}

					//Now look for any instructions
					var instructions=getRepeatInstructions.call(this,elem);

					//Unlike Binder, Repeater clones nodes, which removes any props set on the live node,
					//which implies that we have to store the instructions as string attributes for now
					//and JSON.parse() them to live in prepareClone(). And for future dev.ref: we can't
					//convert them to live here and them copy them to the clone because we clone the entire
					//template, not each child individually... just think about it...
					if(instructions){
						elem.setAttribute('xxxRepeat',JSON.stringify(instructions)); 
						t+=instructions.length

						//If any instructions include '#', mark the entire clone/template
						if(!clone.hasAttribute(TAG_RID) && instructions.find(inst=>inst.pattern.includes('#'))){
							clone.setAttribute(TAG_RID,'');
						}
					}


				}catch(err){
					this._log.error("Failed to prepare template node.",err,elem);
				}
			});
			//Unlike Binder/Nav, here we have templates with multiple children, any of which may have instructions
			//(but usually not all of them). So we send noWarn in getRepeatInstructions(), and now if none of them
			//had any instructions we warn here
			let msg=`Prepared template ${i+1} of ${clones.length},`, attr=Repeater._baseAttr+'_noaction';
			if(t || clone.hasAttribute(attr))
				this._log.debug(`${msg} it has ${t} instructions`);
			else
				this._log.warn(`${msg} but it has no instructions! (if intentional please add attribute '${attr}'`)

		})


		return clones;
	}


	/*
	* Since we're cloning nodes, and may be sharing templates, we can't do all the preparations in prepareTemplates(), 
	* this function does the rest after cloning...
	*
	* @param <HTMLElement> clone 	A newly cloned template
	*
	* @return array 				Array of those child nodes that have instructions
	* @call(<Repeater>)
	*/
	function prepareClone(clone){
		document.adoptNode(clone); //2019-05-23: Trying to solve issue with not being able to find by id... //2020-02-10: ???
		
		//Set a few shortcuts and a flag on the clone to help out... _repeatIndex eg. is used by chooseAndCloneTemplate()
		clone.setAttribute('repeater-item',this._private.targetClass); 
		Object.defineProperties(clone,{
			_repeater:{enumerable:true,get:()=>this}
			,_repeatIndex:{enumerable:true,get:()=>Array.from(clone.parentElement.children).indexOf(clone)}
			,_repeatData:{enumerable:true,get:()=>this._data.get(clone._repeatIndex)}
		})

		
		//Turn all pre-parsed instructions into live objects
		let nodes=this.getNodesWithInstructions(clone)
		nodes.forEach(getRepeatInstructions.bind(this));

		return nodes;
	}


	/*
	* Get instructions from an element
	*
	* @param <HTMLElement> elem
	*
	* @return array|undefined 		An array of objects if instructions exist, else undefined
	* @call(<Repeater>)
	*/
	function getRepeatInstructions(elem){
		//If no live object exists on the elem...
		if(!elem.hasOwnProperty('xxxRepeat')){
			//...and no attribute either...
			if(!elem.hasAttribute('xxxRepeat')){
				//...then look for and parse new instructions, saving it to the prop we checked first ^^
				let instructions=proto.getInstructions.call(this
					,elem
					,validateInstruction.bind(this) //callback used to determine we have a good pattern, throw => don't include
					,this._private.options.debugMode?'extract':''
					,'emptyOK' //don't warn if individual elems don't have instructions, see prepareTemplates() for details
				);

				//If we found any, save them, else at least make sure the prop exists so the the prop we checked first^...
				elem.xxxRepeat=(instructions.length ? instructions : null)

			//If it does have the attribute (which will be the case with every new clone)...
			}else{
				//...just make it live and save it to the prop we checked first ^^...
				elem.xxxRepeat=bu.getJsonAttr(elem,'xxxRepeat');

				//The attr has now served it's purpose, the only reason to keep it is debugging
				if(!this._private.options.debugMode)
					elem.removeAttribute('xxxRepeat');
			}

			//If we found any instructions...
			if(elem.xxxRepeat){
				//...set this Repeater's targetClass on the elem to mark that it's got instructions
				elem.classList.add(this._private.targetClass); 

				//ProTip: If you need to change the instructions on a single element you should delete both prop and 
				//		  attr "xxxRepeat", but leave this class/flag. That way the next time propogateToNodes() is 
				//		  called it'll find this elem but will be forced to look for new instructions
			}
		}

		//Now return what may be instructions, or may be undefined
		return elem.xxxRepeat;
	}




	/*
	* Check that an instruction is valid for a Repeater. This mostly deals with the pattern...
	*
	* @param object inst  				Instructions found on a node, parsed into a live object
	*  @prop string|array key|pattern 	Arrays will be converted: ["person","age"] => "${person.age}"
	*
	* @throw <TypeError>  		If pattern isn't string
	* @throw <ble EMISSMATCH> 	If complex pattern but this Repeater can only handle primitive children
	*
	* @return void 			
	*
	* @call(this) 		
	*/
	function validateInstruction(inst){

		//For Repeater the key is a pattern, so rename it
		inst.pattern=inst.key
		delete inst.key;

		//Make sure it's a string, but an array kan be used to signify a netsted get
		switch(typeof inst.pattern){
			case 'string':
				if(inst.pattern.includes('#')){
					//This will slow things down if we re-order the array often
					this._private.indexDependentPatterns='i';
					this._log.warn("Slow instruction:",inst);
				}else if(!inst.pattern.includes('$')){
					//If there is no special character we assume it's the name of a single prop
					inst.pattern='${'+inst.pattern+'}';
				}
				break;
			case 'object': //really means it's an array, because getInstructions() has already made sure it's a string|number|array
				inst.pattern='${'+inst.pattern.join('.')+'}';
				break;
			case 'number':
				this._log.makeError("Repeater key/pattern cannot be numbers:",inst.pattern).throw('TypeError');
				break;
		}

		//If we only deal in primitive children, then the pattern can't make reference to any props
		if(this._data._private.options.children=='primitive' && inst.pattern.match(/\$\{([^}]+)\}/))
			this._log.makeError(`options.children=='primitive' => no complex patterns: '${inst.pattern}'`).throw('EMISSMATCH');
		 //^the opposite can obviously happen, childen=='complex' but a specific child is primitive...

		
		return;
	}







	/*
	* If multiple templates exist, they have rules when to use them, this method checks those rules
	*
	* @param number index 	Index that $node is at or will be at
	* @param any value 		The 
	* @param array arr 		Array with 2 or 4 items: [template,criteria] or [template,pattern,operator,criteria]
	* @param any value 		The value of an item in the _data
	*
	* @return bool 			True if the template should be used, else false
	* @no-throw
	* @call(this)
	*/
	function checkTemplateRule(index,value,rule,nodeToLog){

		try{
			var pattern=rule[0]
				,resolved=Repeater.applyPattern.call(this,index,value,pattern,nodeToLog) //can throw, usually if pattern type!=value type
				,operator=rule[1]
				,criteria=rule[2]
			;
			return bu.compare.call(this,resolved,operator,criteria);
		}catch(err){
			this._log.error(err);
			return false;
		}


	}




	/*
	* Choose which template to used based on the value of an item
	*
	* @param number insertAt		The index the template is going to be inserted at
	* @param mixed value 		The value of an item of the underlying smarties.Array
	*
	* @throws
	* @return node 			A cloned template, ready to be modified and inserted
	* @call(this)
	*/
	function chooseAndCloneTemplate(insertAt,value){

		//First we clone the template... but there may be multiple, in which case we have to figure out which one...
		if(this._templates.length>1){
			
			var dflt,rules=[];
			for(var i=0;i<this._templates.length; i++){
				var t=this._templates[i];
				if(t.hasAttribute('xxx-repeat_usedefault')){
					dflt=t;
					continue
				}

				//Get the rule which we've already made sure is an array like [pattern,operator,criteria]
				var rule=bu.getJsonAttr(t,'xxx-repeat_useif');

				//store so we can check all rules later if default template is chosen this time
				rules.push(rule); 
				
				//Now check the rule
				if(checkTemplateRule.call(this,insertAt,value,rule,t)){
					var clone=t.cloneNode(true);
					this._log.debug("Rule matched --> cloned template:",rule,clone);
				
					//Define func to check if a new value would still choose this template
					clone._checkRightTemplate=(newValue)=>checkTemplateRule.call(this,clone._repeatIndex,newValue,rule,clone)

					return clone;
				}
			}

			if(!dflt)
				this._log.throw("None of the templates matched this value (and there's no default):",value,rules);	
			
			var clone=dflt.cloneNode(true);	
			this._log.debug("No rule matched, using default:",clone,{value,rules});
			
			//Define func to check that a new value would not choose any of the other templates, ie. default is 
			//still right choice
			clone._checkRightTemplate=(newValue)=>{
				let index=clone._repeatIndex;
				for(var i=0;i<rules.length;i++){
					if(checkTemplateRule.call(this,index,newValue,rules[i],clone))
						return false;
				}
				return true;
			}
			return clone;

		}else{
			var clone=this._templates[0].cloneNode(true);  
			this._log.debug('Only one template existed, cloned that:',clone);
			
			clone._checkRightTemplate=function(){return true;} //Only one option, always the right value
			
			return clone;
		}
	}







	

	/*
	* Propogate a value the DOM
	*
	* @param <HTMLElement> clone 		@see getNodeArray(clone)
	* @param object event 	
	* @param boolean onlyIndexPatterns 	If truthy, only run instructions that contain '#'
	*
	* @return void
	* @call(this)
	*/
	function propogateToNodes(clone, event,onlyIndexPatterns=false){
		if(!event || typeof event!='object'||!event.hasOwnProperty('value')){
			this._log.makeError("Bad data. Could not propogate to repeater item.",{item:clone,data:event}).addFrom().exec();
			return;
		}
		this._log.traceFunc(arguments);

		//Loop through all child nodes with instructions (defined as those marked with this._private.targetClass)
		var nodes=this.getNodesWithInstructions(clone), node, inst;
		for(node of nodes){
			if(!Array.isArray(node.xxxRepeat)||!node.xxxRepeat.length){
				this._log.error('BUGBUG No instructions on node:',node);
			}else{
				//If a pattern exists, apply it
				//...then loop throught the instructions and apply
				for(inst of node.xxxRepeat){
					
					//If this is an index change, don't run any instructions that aren't index dependent...
					if(onlyIndexPatterns && !event.pattern.includes('#'))
						continue;

					this.executeAction(node,inst,event);	 //should not throw
				}
			}
			
		}

		return;

	}




	return Repeater;
}//correct, we do NOT run this function here, see ./require_all.js
//simpleSourceMap=
//simpleSourceMap2=










	// /*
	// * Apply a pattern to a complex or primitie value, getting a string in return
	// *
	// * @param string pattern
	// * @param primitive|mixed value 	If this.options.children=='primitive' => primitive, else this can be anyhing
	// * @opt <HTMLElement> node 		For logging purposes only!
	// *
	// * @throw <ble TypeError> If $pattern isn't string (prepareTemplates() should have ensured we get string 
	// *							so this doesn't happen)
	// * @throw <ble Error> 	 If pattern type and value type mismatch
	// * @return string
	// */
	// Repeater.prototype.applyPattern=function(pattern,value,node=undefined){
	// 	//First handle the 3 most simple cases
	// 	if(pattern=='#')
	// 	//Determine which syntax to use...
	// 	if(determinePatternType(pattern)=='complex'){
	// 		if(typeof value=='object' || !value){//All complex or falsey values
	// 			return applyComplexPattern.call(this,pattern,value,node);

	// 		}else{
	// 			this._log.makeError("Got complex pattern but primitive value:",{pattern,value,node}).throw();
	// 		}

	// 	}else{//pattern in primitive
	// 		if(value && typeof value=='object'){
	// 			//All non-primitives, excluding null
	// 			this._log.makeError("Got primitive pattern but complex value:",{pattern,value,node}).throw();
	// 		}else{
	// 			this._log.trace("Resolving primitive pattern:",{pattern,value,node});
	// 			if(value==undefined || value==null){
	// 				return pattern.replace('#','');
	// 			}else{
	// 				//All primitive values
	// 				return pattern.replace('#',value);
	// 			}
	// 		}

	// 	}


	// }


	// /*
	// * Broken out from applyPattern() to make code less condense. But only call it from there...
	// *
	// *	
	// * @opt <HTMLElement> node 			For logging purposes only!
	// *
	// * @return string 
	// * @call(this) 		for logging
	// */
	// function applyComplexPattern(pattern, value, node){

	// 	var resolved=pattern; //init
		
	// 	//Find all the matching patterns...
	// 	var regexp=/\$\{([^}]+)\}/g
	// 		,matches=bu.regexpAll(regexp,pattern)
	// 		,logMsg
	// 		,lvl='trace'
	// 	;

	// 	if(value){
	// 		// var self=this;
	// 		var noMatchedKeys=true;
	// 		matches.forEach(function resolveEachPatternMatch(arr){
	// 			//...and swap them for the value of the corresponding key
	// 			if(value.hasOwnProperty(arr[1])){
	// 				noMatchedKeys=false
	// 				resolved=resolved.replace(arr[0],value[arr[1]]);
	// 			}else{
	// 				resolved=resolved.replace(arr[0],'');
	// 			}				
	// 		})
	// 		logMsg="Resolved complex pattern.";
	// 		if(noMatchedKeys){
	// 			lvl='warn';
	// 			logMsg+=' No keys matched!'
	// 		}

	// 	}else{
	// 		matches.forEach(function removeEachPatternMatch(arr){
	// 			resolved=resolved.replace(arr[0],'');
	// 		})
	// 		logMsg="Empty value passed in, removed all matches from pattern.";
	// 		lvl='info'
	// 	}
		
	// 	//Make sure "true"=>true etc.
	// 	resolved=bu.stringToPrimitive(resolved);

	// 	if(!resolved){
	// 		logMsg+=' Resulting string is empty!'
	// 		lvl=(lvl=='warn'?lvl:'note');
	// 	}

	// 	//If we're testing templates to see which one to use, always log debug since most
	// 	//of them are expected to produce empty strings
	// 	if(node && !document.contains(node)){
	// 		lvl='debug'
	// 	}

	// 	this._log[lvl](logMsg, node,{'object':value,pattern,regexp,matches,resolved});
	
	// 	return resolved;
	// }

# xxx
A lightweight front-end framework that provides two-way binding, repeating templates and UI navigation

## Outline
The library consists of 3 constructors that each provides one of the above mentioned features; Binder, Repeater, and Navigator. You set instructions straight on HTML <b>elements</b> in the DOM via attributes like 'xxx-bind', then create <b>instances</b> of the classes to consume and execute those actions. Elements are linked to instances via a "target class" which can be added to any elements classList at any time.

## Installation
1. Install the npm package: `npm -i xxx-framework`

2a. Then either load the bundled version directly in the browser as you would any script. But remember you can't use it until you've also loaded libbetter. Both will set directly on the window.
```html
<script src="path/to/xxx/dist/xxx.js" type="text/javascript"></script>
<script type="text/javascript">
  try{
    new window.xxx.Binder('foo');
  }catch(err){
    console.error(err); // E_DEPENDENCY
  }; 
</script>
<script src="path/to/libbetter/dist/libbetter.js" type="text/javascript"></script>
<script type="text/javascript">
  console.log(window.xxx); // {Binder: ƒ, Repeater: ƒ, Navigator: ƒ}
</script>
```

2b. Or require the entire package into another script, initialize it with it's dependencies, then bundle that.
 ```javascript
 var libbetter=require('libbetter');
 var xxx=require('xxx-framework')(libbetter);
 console.log(xxx); // {Binder: ƒ, Repeater: ƒ, Navigator: ƒ}
 ```
 ```html
<script src="path/to/xxx/dist/xxx.js" type="text/javascript">
```

3. Use them! They work together or alone. Check out the [examples](examples).


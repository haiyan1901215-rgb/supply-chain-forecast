/* Preview namespaces never write the active version's storage keys. */
const forecastStorage=(()=>{
  const prefix=window.forecastStorageScope||'';
  const keys=['pmc-forecast-v019-current','pmc-sales-forecast-notes-v1','pmc-forecast-v019-columns','pmc-forecast-column-widths-v024'];
  if(prefix){
    try{
      if(localStorage.getItem(prefix+'initialized')!=='1'){
        for(const key of keys){const value=localStorage.getItem(key);if(value!==null&&localStorage.getItem(prefix+key)===null)localStorage.setItem(prefix+key,value);}
        localStorage.setItem(prefix+'initialized','1');
      }
    }catch{/* Existing application persistence handling reports storage failures. */}
  }
  return Object.freeze({getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key)});
})();

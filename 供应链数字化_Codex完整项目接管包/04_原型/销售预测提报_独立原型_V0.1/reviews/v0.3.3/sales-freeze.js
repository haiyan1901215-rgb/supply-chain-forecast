/* Frozen sales presentation; workflow state is owned by pmc-workflow.js. */
(() => {
  const previousProduct=productCell;
  productCell=function(g,c,span){
    const template=document.createElement('template');template.innerHTML='<table><tbody><tr>'+previousProduct(g,c,span)+'</tr></tbody></table>';
    const cell=template.content.querySelector('td'),info=cell.querySelector('.product-info'),tags=cell.querySelector('.product-tags');
    const listing=Array.from(cell.querySelectorAll('.product-meta')).find(el=>el.textContent.trim().startsWith('上架'));
    if(info){if(listing){listing.classList.add('sales-listing');info.append(listing);}if(tags){tags.classList.add('sales-tags');info.append(tags);}}
    return cell.outerHTML;
  };
  renderTable();
})();

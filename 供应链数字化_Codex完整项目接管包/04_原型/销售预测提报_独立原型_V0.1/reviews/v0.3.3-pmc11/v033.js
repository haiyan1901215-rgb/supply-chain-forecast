/* ISO week labels remain compact; the lower date-header row keeps the date context. */
(() => {
  const previousWeekHeaders=weekHeaders;
  weekHeaders=function(){
    const template=document.createElement('template');
    template.innerHTML='<table><thead><tr>'+previousWeekHeaders()+'</tr></thead></table>';
    template.content.querySelectorAll('.week-heading > span').forEach(label=>{
      const week=label.textContent.match(/^W\d+/);
      if(week)label.textContent=week[0];
    });
    return template.content.querySelector('tr').innerHTML;
  };
  renderTable();
})();

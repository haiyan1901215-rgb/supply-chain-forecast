/* V0.3.2 retains the native forecast grid and all business state. */
(() => {
  const tokens=antd.theme.getDesignToken(enterpriseThemeV020);
  const withAlpha=(hex,alpha)=>'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+alpha+')';
  const weekHeadersBefore=weekHeaders;
  weekHeaders=function(){
    const template=document.createElement('template');
    template.innerHTML='<table><thead><tr>'+weekHeadersBefore()+'</tr></thead></table>';
    template.content.querySelectorAll('.current-week-label').forEach(el=>el.remove());
    template.content.querySelectorAll('.current-forecast-week').forEach(el=>el.classList.remove('current-forecast-week'));
    template.content.querySelector('.week-head')?.classList.add('first-time-header');
    return template.content.querySelector('tr').innerHTML;
  };
  const previousRender=renderTable;
  renderTable=function(){
    previousRender();
    const table=$('.forecast-table');
    if(table){
      table.dataset.presentationVersion='0.3.2';
      table.style.setProperty('--forecast-cross-color',withAlpha(tokens.colorPrimary,0.045));
      table.style.setProperty('--forecast-focus-border',withAlpha(tokens.colorPrimary,0.18));
      table.style.setProperty('--forecast-weekend-bg',tokens.colorFillAlter);
    }
    positionForecastDivider();
  };
  renderTable();
})();

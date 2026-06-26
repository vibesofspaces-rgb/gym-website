(function(){
  // Nav toggle
  var t=document.getElementById('navToggle'),h=document.querySelector('.nav');
  if(t&&h){
    t.addEventListener('click',function(){h.classList.toggle('nav-open')});
    document.addEventListener('click',function(e){if(!h.contains(e.target)&&h.classList.contains('nav-open'))h.classList.remove('nav-open')});
  }

  // Active link
  var p=window.location.pathname.split('/').pop()||'index.html';
  [].forEach.call(document.querySelectorAll('.nav-links a:not(.nav-cta)'),function(a){
    if(a.getAttribute('href')===p||(p===''&&a.getAttribute('href')==='/'))a.classList.add('active');
  });

  // Nav CTA swap for logged-in users
  if(localStorage.getItem('token')){
    var c=document.querySelector('.nav-cta');
    if(c){c.textContent='Dashboard';c.href='dashboard.html'}
  }

  // Scroll-triggered animations
  var observer=null;
  function observeAnimations(){
    if(observer)observer.disconnect();
    observer=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}
      });
    },{threshold:0.1});
    [].forEach.call(document.querySelectorAll('.anim,.anim-up,.anim-scale,.anim-slide,.anim-in'),function(el){observer.observe(el)});
  }
  observeAnimations();
  // Expose for dynamic content
  window.observeAnims=observeAnimations;
})();

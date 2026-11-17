/* MW4 Hub theme interactions */
(function () {
	'use strict';
	var header = document.querySelector('.site-header');
	var onScroll = function () {
		if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	var toggle = document.querySelector('.nav-toggle');
	var mobile = document.getElementById('mobile-nav');
	if (toggle && mobile) {
		toggle.addEventListener('click', function () {
			var open = toggle.getAttribute('aria-expanded') === 'true';
			toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
			mobile.hidden = open;
		});
	}

	var els = document.querySelectorAll('.reveal');
	if ('IntersectionObserver' in window && els.length) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (en) {
				if (en.isIntersecting) {
					en.target.classList.add('in');
					io.unobserve(en.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
		els.forEach(function (el) { io.observe(el); });
	} else {
		els.forEach(function (el) { el.classList.add('in'); });
	}
})();

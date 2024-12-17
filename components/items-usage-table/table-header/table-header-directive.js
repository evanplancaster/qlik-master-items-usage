define( ["qvangular", "jquery", "text!./table-header-template.ng.html"],
	function (qvangular, jquery, ngHeaderTemplate ) {
		'use strict';
		qvangular.directive( 'tableHeader', function() {
			return {
				restrict: "A",
				template: ngHeaderTemplate
			}
		});
        
	});
	
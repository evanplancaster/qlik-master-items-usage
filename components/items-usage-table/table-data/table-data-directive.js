define( ["qvangular", "jquery", "text!./table-data-template.ng.html"],
	function (qvangular, jquery, ngDataTemplate ) {
		'use strict';
		qvangular.directive( 'tableData', function() {
			return {
				restrict: "A",
				template: ngDataTemplate
			}
		});
	});
	
define(["qlik", 
	"text!./assets/css/style.css", 
	"text!./main-template.ng.html", 
	"./assets/js/qlik_data", 
	"./assets/js/table_ui", 
	"./components/items-usage-table/items-usage-table-directive",
	"./components/items-usage-table/table-header/table-header-directive",
	"./components/items-usage-table/table-data/table-data-directive"
], 
	function(qlik, 
		cssContent, 
		html, 
		qlik_data, 
		table_ui) {
    "use strict";

    // Add CSS to the head
    $("<style>").html(cssContent).appendTo("head");

    return {
		definition: {},
        initialProperties: {
            version: 1.0
        },
		template: html,
		controller: ['$scope', function ($scope) {
            
			//Initialize variables
			const app = qlik.currApp(this);
			console.log(qlik);
			
			var dataService = qlik_data(app, $scope);
			var tableUiService = table_ui($scope);
			
			$scope.inUse = {};
			$scope.notInUse = {};

			$scope.inUse.columns = [
				{fieldName: 'sheetId', displayName: 'Sheet ID'}, 
				{fieldName: 'sheetName', displayName: 'Sheet Name'}, 
				{fieldName: 'sheetStatus', displayName: 'Sheet Status'}, 
				{fieldName: 'vizId', displayName: 'Object ID'}, 
				{fieldName: 'vizType', displayName: 'Object Type'}, 
				{fieldName: 'name', displayName: 'Master Item Name'},
				{fieldName: 'id', displayName: 'Master Item ID'},
				{fieldName: 'type', displayName: 'Master Item Type'}
			];
			$scope.notInUse.columns = [
				{fieldName: 'name', displayName: 'Master Item Name'},
				{fieldName: 'id', displayName: 'Master Item ID'},
				{fieldName: 'type', displayName: 'Master Item Type'}
			];

			//Create a Master Items List and then...
			dataService.createMasterItemsList().then(masterItemsList => {
				dataService.getSheets()
				.then(async (result) => {
					let visPromArray =[];
					result.forEach(sheet => {								
						sheet.qData.cells.forEach(function(viz){
							viz.id = viz.name;						//this is the Object ID that will be used for initial processing
							viz.mainObjId = viz.name;				//this is the Object ID, stored as the OG for reference
							viz.sheetId = sheet.qInfo.qId;			//this is the Sheet ID
							viz.sheetName = sheet.qMeta.title;		//This is the Sheet Title
							viz.sheetStatus = dataService.sheetStatus(sheet);	//This is the sheet's publish status
							visPromArray.push(dataService.processObject(viz.id, viz, masterItemsList));
						});
					});
					await Promise.all(visPromArray).then(final => {
						var records = final.flat();
						var masterItemIds = [...new Set(masterItemsList.map(j=>{return j.id}))];
						var usedItemIds = [...new Set(records.map(i=>{return i.id}))];
						var unUsedItems = masterItemsList.filter(i => {
							return !usedItemIds.includes(i.id);
						});
						
						records.forEach(i => {
							try {
								i.name = masterItemsList.filter(j => {return i.id === j.id})[0].name;
								i.type = masterItemsList.filter(j => {return i.id === j.id})[0].type;
							} catch (error) {
								records = records.filter(j => {return j.id !== i.id});
							}
						});
						return records.concat(unUsedItems);
					})
					.then(recordsObj => {
						var nestedMasterItemsArr = [];
						masterItemsList.forEach(item => {
							console.log(item); 

							var temp = masterItemsList.filter(i => {
								return item.expression.includes("["+i.name+"]");
							});
							if (temp.length > 0) {
								temp.forEach(i => {i.masterItemPath = 'Measure '+item.id+': "'+item.name+'"'});
								nestedMasterItemsArr.push(temp);
							};
							console.log(temp);
						
							nestedMasterItemsArr = nestedMasterItemsArr.flat();
							console.log(nestedMasterItemsArr);

							if(nestedMasterItemsArr.length > 0){
								var expressions = nestedMasterItemsArr.map(exp => {
									var newRecord = {
										"id": exp.id, 
										"sheetId": "",
										"sheetName": "",
										"vizId": "",
										"vizType": exp.masterItemPath,
										"masterItemPath": exp.masterItemPath,
										"masterItemInUse": true,
										"deleteMe": false,
										"inSearch": true,
										"sheetStatus": "",
										"name": exp.name,
										"type": exp.type
									};
									
									recordsObj = recordsObj.filter(k => {return !(k.id === newRecord.id && k.masterItemInUse === false) });
									recordsObj.push(newRecord);
									
								});
							};
						});
						
						//console.log(recordsObj);
						//$scope.masterItemsData = recordsObj;
						$scope.notInUse.data = recordsObj.filter(i => {return tableUiService.notInUseFilter(i)});
						$scope.inUse.data = recordsObj.filter(i => {return tableUiService.inUseFilter(i)});
					});
					
				});
			});
			
			$scope.sortBy = tableUiService.sortBy;
			$scope.toggleSearch = tableUiService.toggleSearch;
			$scope.inUseFilter = tableUiService.inUseFilter;
			$scope.notInUseFilter = tableUiService.notInUseFilter;
			$scope.itemsSelected = tableUiService.itemsSelected;
			$scope.anyChecked = tableUiService.anyChecked;
			$scope.toggleAllChecks = tableUiService.toggleAllChecks;
			$scope.copy = tableUiService.copy;
			$scope.deleteMasterItems = dataService.deleteMasterItems;
        }]
    };
});

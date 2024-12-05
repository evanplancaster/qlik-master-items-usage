define(["qlik", "text!./Master_Item_Usage.css", "text!./Master_Item_Usage.ng.html"], function(qlik, cssContent, html) {
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
			console.log(app);
            
			var masterItemRecords = [];
			$scope.propertyName = 'sheetName';
			$scope.reverse = false;
			$scope.searchResults = {
				"sheetName": "",
				"sheetId": "",
				"vizId": "",
				"vizType": "",
				"name": "",
				"id": "",
				"type": "",
				"sheetStatus": ""
			};

            
			//This function gets every path in an object. We do this so we can find all references to "qLibraryId", which
			//is the identifying marker for master items, as well as to examine expressions to find any references to 
			//master measures. This also allows us to find any visualizations that are actually master visualizations,
			//which we'll need to know so we can dig into the main visualization's properties.
			function getPath(jsonObj, currentPath = '') {
				const paths = [];
				//console.log(jsonObj);
				
				for (const key in jsonObj) {
					if (jsonObj.hasOwnProperty(key)) {
						const newPath = currentPath ? `${currentPath}.${key}` : key;

						if (typeof jsonObj[key] === 'object' && jsonObj[key] !== null) {
							// Recurse into nested objects
							paths.push(...getPath(jsonObj[key], newPath));
						} else {
							// Add the path if it's a leaf node
							paths.push(newPath);
						}
					}
				}
				//console.log(paths);
				return paths;
			}

			//This function gets the values of object paths. This allows us to get an expression or the id of a master item.
			function getValuesFromPaths(jsonObj, pathsArr) {
				const results = {};

				pathsArr.forEach(path => {
					const keys = path.split('.');
					let value = jsonObj;

					for (let key of keys) {
						if (value && key in value) {
							value = value[key];
						} else {
							value = null;
							break;
						}
					}

					if (value !== "") {results[path] = value;}
				});

				return results;
			}
			
			var sheetStatus = function (sheetProps) {
				if (sheetProps.qMeta.approved) {
					return "Public";
				} else if (sheetProps.qMeta.published) {
					return "Community";
				} else {
					return "Private";
				}
			};
			
			async function getPropTree(objId) {
				return app.getObjectProperties(objId)
				.then(propsResult => {
					//console.log(propsResult);
					return propsResult.getFullPropertyTree();
				})
				.then(async (treeResult) => {
					//****************this will process master visualizations by recalling the getPropTree function using the master viz's ID****************
					//console.log(treeResult);
					if (treeResult.qProperty.qExtendsId && treeResult.qProperty.hasOwnProperty('qExtendsId')) {
						//console.log('rerunning');
						return getPropTree(treeResult.qProperty.qExtendsId);
					//****this processes all the dumb vizlib stuff	
					} else if (treeResult.qProperty.visualization === 'VizlibSheetMenuPlus' || treeResult.qProperty.visualization === 'VizlibContainer') {
						var sheetMenuPaths = getPath(treeResult).filter(i =>{
							//console.log(i);
							var test = i.endsWith('masterItem.id') || i.endsWith('masterItemId');
							return test;
						});
						var sheetMenuMasterItemIds = getValuesFromPaths(treeResult, sheetMenuPaths);
						var sheetMenuMasterItems = Object.entries(sheetMenuMasterItemIds).filter(j => {return j[1] !== ""});
						//console.log(sheetMenuMasterItems);
						
						var children = await Promise.all(sheetMenuMasterItems.map(child => {return getPropTree(child[1]);}));
						return children;

					//****************this will process objects that have children by recalling the getPropTree function using each child's ID****************						
					} else if (treeResult.qChildren.length > 0) {
						//console.log(objId+" has "+treeResult.qChildren.length+" children.");
						
						var children = await Promise.all(treeResult.qChildren.map(child => {return getPropTree(child.qProperty.qInfo.qId);}));
						return children;
					} else {
						//console.log(treeResult);
						return treeResult;
					}
				});
			}

			async function processObject(visId, vis, masterItemsList) {
				//console.log(masterItemsList);
				return getPropTree(visId)
				.then(tree => {
					//go thru each object and find references to qLibraryId
//					console.log(tree);
					var masterItemPaths = getPath(tree).filter(i =>{
						//console.log(i);
						var test = i.includes('qLibraryId');
						//console.log(test);
						return test;
					});
					var masterItemIDs = getValuesFromPaths(tree, masterItemPaths);
					var masterItemsTemp = Object.entries(masterItemIDs).filter(j => {return j[1] !== ""});
					var masterItem;
					//console.log(masterItemsList);
					masterItemsTemp.forEach(item => {
						//console.log(item); 

						var foundMasterItems = masterItemsList.filter(i => {
							//console.log(item[1]); 
							if (item[1]){
								return item[1] === i.id;// && i.name;
							}
							return null;
						});
						if (foundMasterItems) {
							foundMasterItems.masterItemPath = item[0];
							masterItem = (foundMasterItems);
						};
						//console.log(temp);
					});
					
					//console.log(masterItemsTemp);
					//This gives us an array of arrays, each of which has i[0] = <path> and i[1] = <value>.
					//Want it to look like an array of objects, each looking like {"path": i[0], "id": i[1]}
					var newRecord = {};
					var masterItems = masterItemsTemp.map(item => {
						newRecord = {
							"id": item[1], 
							"sheetId": vis.sheetId,
							"sheetName": vis.sheetName,
							"vizId": vis.id,
							"vizType": vis.type,
							"masterItemPath": item[0],
							"masterItemInUse": true,
							"deleteMe": false,
							"inSearch": true,
							"sheetStatus": vis.sheetStatus
						};
						
						return newRecord;
					});
					
					//console.log("The following master items are found in the "+vis.type+" "+visId+":");
					//console.log(masterItems);
					
					var expressionsPaths = getPath(tree).filter(i => {return i.endsWith('.qDef') || i.endsWith('qCond.qv') || i.endsWith('qMsg.qv')}); 
					var expressionsObj = getValuesFromPaths(tree, expressionsPaths);
					var expressionsTemp = Object.entries(expressionsObj).filter(j => {return j[1] !== ""});
					
					var masterItemsFromExp = [];
					expressionsTemp.forEach(item => {
						//console.log(item); 

						var temp = masterItemsList.filter(i => {
							//console.log(item[1]); 
							if (item[1]){
								//console.log(item[1]+' found');
								return item[1].includes("["+i.name+"]");// && i.name;
							}
							return null;
						});
						if (temp.length > 0) {
							temp.forEach(i => {i.masterItemPath = item[0]});
							masterItemsFromExp.push(temp);
						};
						//console.log(temp);
					});
					
					masterItemsFromExp = masterItemsFromExp.flat();
					//console.log(masterItemsFromExp);
					
					if(masterItemsFromExp.length > 0){
						var expressions = masterItemsFromExp.map(exp => {
							newRecord = {
								"id": exp.id, 
								"sheetId": vis.sheetId,
								"sheetName": vis.sheetName,
								"vizId": vis.id,
								"vizType": vis.type,
								"masterItemPath": exp.masterItemPath,
								"masterItemInUse": true,
								"deleteMe": false,
								"inSearch": true,
								"sheetStatus": vis.sheetStatus
							};

							return newRecord;
						});
					};
					
					var finalList = masterItems.concat(expressions).filter(i => i !== undefined);
					//console.log(finalList);
					
					return finalList;
				});
			}

			async function getSheets(){
				const resultSheetsList = await app.getList('sheet');
				return resultSheetsList.layout.qAppObjectList.qItems;
			}
			
			async function createDimsList(){
				let dimensionsListFinal = [];
				const dimsList = await app.getList('DimensionList');
				let dimensionsTemp = dimsList.layout.qDimensionList.qItems;
				dimensionsTemp.forEach(dim => {
					var dimInfo = {
						"id": dim.qInfo.qId, 
						"name": dim.qData.title,
						"type": "dimension",
						"sheetId": "",
						"sheetName": "",
						"vizId": "",
						"vizType": "",
						"masterItemPath": "",
						"masterItemInUse": false,
						"expression": ""
					};
					dimensionsListFinal.push(dimInfo);
				});
				//console.log(dimensionsListFinal);
				return dimensionsListFinal;
			}
			
			async function createMeasList(){
				let measuresListFinal = [];
				const measList = await app.createGenericObject({
					qInfo: {
						qType: "MeasureList"
					},
					qMeasureListDef: {
						qType: "measure",
						qData: {
							qMeasure: "/qMeasure"
						}
					}
				});
				
				let measuresTemp = measList.layout.qMeasureList.qItems;
				console.log(measuresTemp);
				measuresTemp.forEach(async mea => {
					var meaInfo = {
						"id": mea.qInfo.qId, 
						"name": mea.qMeta.title,
						"expression": mea.qData.qMeasure.qDef,
						"type": "measure",
						"sheetId": "",
						"sheetName": "",
						"vizId": "",
						"vizType": "",
						"masterItemPath": "",
						"masterItemInUse": false
					};
					//meaInfo.masterItemInUse = measuresTemp.filter(i => {return i.qData.qMeasure.qDef.includes('['+meaInfo.name+']');}).length > 0;
					console.log(meaInfo);
					measuresListFinal.push(meaInfo);
				});
				//console.log(measuresListFinal);
				return measuresListFinal;
			}
			
			async function createMasterItemsList (){
				let promArray = [];
				let dList = createDimsList();
				let mList = createMeasList();
				promArray.push(dList);
				promArray.push(mList);
				const masterItemsArray = await Promise.all(promArray);
				//console.log(masterItemsArray[0].concat(masterItemsArray[1]));
				return masterItemsArray[0].concat(masterItemsArray[1]);
			}
			
			//Create a Master Items List and then...
			createMasterItemsList().then(masterItemsList => {
				//console.log(masterItemsList);
				
				//...get the sheets and their objects.
				getSheets()
				.then(async (result) => {
					//result is an array of sheets, each with an array of visualization objects
					//I need to take this array and push another array of promises through
					//for each sheet so that they all get processed in parallel.
					let visPromArray =[];
					result.forEach(sheet => {		
						
						sheet.qData.cells.forEach(function(viz){
							//console.log(sheet);
							//console.log(JSON.parse(JSON.stringify(masterItemsList)));
							//get all the info for each object you can; NOTE--viz.type is already there
							viz.id = viz.name;						//this is the Object ID that will be used for initial processing
							viz.mainObjId = viz.name;				//this is the Object ID, stored as the OG for reference
							viz.sheetId = sheet.qInfo.qId;			//this is the Sheet ID
							viz.sheetName = sheet.qMeta.title;		//This is the Sheet Title
							viz.sheetStatus = sheetStatus(sheet);	//This is the sheet's publish status
							
							
							//console.log(viz);
							//Promise to process each object.
							visPromArray.push(processObject(viz.id, viz, masterItemsList));
						});
					});
					await Promise.all(visPromArray).then(final => {
						//console.log(final);
						/*records will have all the master items in use.
						Still to do is:
							3. (bonus) maybe somehow get children's viz types attached to main viz type?
							4. prolly some other stuff I haven't thought of yet...
						*/
						var records = final.flat();
						//console.log(records);
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
						
						//$scope.masterItemsData = records.concat(unUsedItems);
						//console.log($scope.masterItemsData);
						return records.concat(unUsedItems);
					})
					.then(recordsObj => {
						var nestedMasterItemsArr = [];
						masterItemsList.forEach(item => {
							console.log(item); 

							var temp = masterItemsList.filter(i => {
								//console.log(item[1]); 
								return item.expression.includes("["+i.name+"]");
							});
							if (temp.length > 0) {
								temp.forEach(i => {i.masterItemPath = 'Measure '+item.id+': "'+item.name+'"'});
								nestedMasterItemsArr.push(temp);
							};
							console.log(temp);
						//});

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
						
						
						
						/*
						masterItemsList.forEach(j => {
							//meaInfo.masterItemInUse = measuresTemp.filter(i => {return i.qData.qMeasure.qDef.includes('['+meaInfo.name+']');}).length > 0;
							
							j.masterItemInUse = masterItemsList.filter(i => {
								console.log(i);
								return i.expression.includes('['+j.name+']');
							}).length > 0;
						});
						*/
						
						$scope.masterItemsData = recordsObj; //recordsObj.used.concat(recordsObj.unused);
						console.log($scope.masterItemsData);
					});
					
					
					//Then go through and filter down the master items to the ones that aren't in the records
					//and mark those as not in use.
					
				});
			});
			
			$scope.sortBy = function(propertyName) {
				$scope.reverse = ($scope.propertyName === propertyName) ? !$scope.reverse : false;
				$scope.propertyName = propertyName;
				console.log('reverse: '+$scope.reverse);
				$scope.propertyName = propertyName;
				console.log('propertyName: '+$scope.propertyName);
			};

			$scope.toggleSearch = function(e, property){
				$(".searchbar_"+property).toggle();
				console.log(e);
				$(e.currentTarget).next().next().children().focus();
			};

			var isVisible = function(item){
				//console.log($scope.searchResults.sheetName);
				let sheetNameMatchesSearch = item.sheetName ? item.sheetName.toLowerCase().includes($scope.searchResults.sheetName.toLowerCase()) : false;
				let sheetIdMatchesSearch = item.sheetId ? item.sheetId.toLowerCase().includes($scope.searchResults.sheetId.toLowerCase()) : false;
				let vizIdMatchesSearch = item.vizId ? item.vizId.toLowerCase().includes($scope.searchResults.vizId.toLowerCase()) : false;
				let vizTypeMatchesSearch = item.vizType ? item.vizType.toLowerCase().includes($scope.searchResults.vizType.toLowerCase()) : false;
				let nameMatchesSearch = item.name ? item.name.toLowerCase().includes($scope.searchResults.name.toLowerCase()) : false;
				let idMatchesSearch = item.id ? item.id.toLowerCase().includes($scope.searchResults.id.toLowerCase()) : false;
				let typeMatchesSearch = item.type ? item.type.toLowerCase().includes($scope.searchResults.type.toLowerCase()) : false;
				let sheetStatusMatchesSearch = item.sheetStatus ? item.sheetStatus.toLowerCase().includes($scope.searchResults.sheetStatus.toLowerCase()) : false;
				const sheetNameCheck = (sheetNameMatchesSearch || !$scope.searchResults.sheetName);
				const sheetIdCheck = (sheetIdMatchesSearch || !$scope.searchResults.sheetId);
				const vizIdCheck = (vizIdMatchesSearch || !$scope.searchResults.vizId);
				const vizTypeCheck = (vizTypeMatchesSearch || !$scope.searchResults.vizType);
				const nameCheck = (nameMatchesSearch || !$scope.searchResults.name);
				const idCheck = (idMatchesSearch || !$scope.searchResults.id);
				const typeCheck = (typeMatchesSearch || !$scope.searchResults.type);
				const sheetStatusCheck = (sheetStatusMatchesSearch || !$scope.searchResults.sheetStatus);
				let searchCheck = sheetNameCheck && sheetIdCheck && vizIdCheck && vizTypeCheck && nameCheck && idCheck && typeCheck && sheetStatusCheck;
				//let showInUseItems = item.masterItemInUse && searchCheck;
				//let showNotInUseItems = !item.masterItemInUse && searchCheck;
				
				//return {"inUseItems": showInUseItems, "notInUseItems": showNotInUseItems};
				item.inSearch = searchCheck;
				return searchCheck;
			};
			
			$scope.inUseFilter = function(item){
				return isVisible(item) && item.masterItemInUse;
			};
			
			$scope.notInUseFilter = function(item){
				return isVisible(item) && !item.masterItemInUse;
			};
			
			$scope.deleteMasterItems = function(){
				let toBeDeleted = $scope.masterItemsData.filter(i => {return i.deleteMe});
				let toBeKept = $scope.masterItemsData.filter(i => {return !i.deleteMe});
				//console.log(toBeDeleted);
				toBeDeleted.forEach(item => {
					let deleteProm;
					if (item.type === "measure") {
						deleteProm = app.model.engineApp.destroyMeasure(item.id);
					} else if (item.type === "dimension") {
						deleteProm = app.model.engineApp.destroyDimension(item.id);
					}
					deleteProm.then(result => {
						console.log(result);
						if (!result.qSuccess) {
							throw new Error("Master Item(s) not deleted.");
						} else {
							$scope.masterItemsData = toBeKept;
						}
					})
					.catch(error => {
						console.log("Nope!");
						console.log(error);
					});
				});
				
			}; 
			
			//Are any master items selected?
			$scope.itemsSelected = function(){
				let deleteAllButtonEnabled = false;
				let clearSelButtonEnabled = false;
				if ($scope.masterItemsData) {
					$scope.masterItemsData.forEach(item => {
						if (item && item.deleteMe) {
							deleteAllButtonEnabled = true;
						}
					});
				}
				return deleteAllButtonEnabled;
			};
			
			//Initialize anyChecked to false, since we don't start with anything checked
			$scope.anyChecked = false;
			
			//This function looks at all visible items (either via search or just all items if search fields are empty)
			//and toggles their check statuses
			$scope.toggleAllChecks = function(){
				//Once master items are loaded...
				if($scope.masterItemsData) {
					//...determine which are visible at the moment...
					var visibleItems = $scope.masterItemsData.filter(i => {return i.inSearch && !i.masterItemInUse});
					console.log(visibleItems);
					//...and of those, determine which ones are checked.
					var checkedVisibleItems = visibleItems.filter(i => {return i.deleteMe});
					console.log(checkedVisibleItems);
					var unCheckedVisibleItems = visibleItems.filter(i => {return !i.deleteMe});
					console.log(unCheckedVisibleItems);
					
					
					/*
					OK, so I need to figure out how to bulk check/uncheck these boxes.
					I think the best way to do that is:
						* determine how many are checked and visible compared to how many are visible
						* if there are none checked in the visible list (i.e., numCheckedVisible === 0), then check all visible
						* if there are some (but not all) checked in the visible list (i.e., numCheckedVisible < numVisible), then check all the rest in the visible list
						* if there are all checked in the visible list (i.e., numCheckedVisible === numVisible), then uncheck all the ones in the visible list
					*Do I also want to filter to only those that are checked? Maybe...
					*/
					
					var numCheckedVisible = checkedVisibleItems.length;
					var numVisible = visibleItems.length;
					
					if (numCheckedVisible === 0) {
						visibleItems.forEach(i => {i.deleteMe = true});
					}
					else if (numCheckedVisible < numVisible) {
						unCheckedVisibleItems.forEach(i => {i.deleteMe = true});
					}
					else /*all visible are selected*/ {
						visibleItems.forEach(i => {i.deleteMe = false});
					}
					
					/*
					//If there are any checked...
					if (checkedVisibleItems.length > 0) {
						//uncheck them all
						checkedVisibleItems.forEach(item => {
							item.deleteMe = false;
						});
						//$scope.anyChecked = false;
						
					//If there are none checked at the moment...
					} else if (!$scope.anyChecked) {
						//...find the ones that are unchecked but are in the search results and check them all
						var checkedItems = $scope.masterItemsData.filter(i => {return !i.deleteMe && i.inSearch});
						checkedItems.forEach(item => {
							item.deleteMe = true;
						});
						$scope.anyChecked = true;
					}
					*/
				}
			};
			

			$scope.copy = function(text){
				var data = [new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) })];
				navigator.clipboard.write(data).then(function() {
				  console.log("Copied to clipboard successfully!");
				}, function() {
				  console.error("Unable to write to clipboard. :-(");
				});
			};
        }]
    };
});

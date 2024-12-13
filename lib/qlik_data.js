define(["./utilities"], function(utils, s) {
    "use strict";
    return function(app, s){
        console.log(s);
        return {
            getPropTree: function(objId) {
				return app.getObjectProperties(objId)
				.then(propsResult => {
					//console.log(propsResult);
					return propsResult.getFullPropertyTree();
				})
			},
            processTree: async function(treeResult) {
				//****************this will process master visualizations by recalling the getPropTree function using the master viz's ID****************
				console.log(treeResult);
				if (treeResult.qProperty.qExtendsId && treeResult.qProperty.hasOwnProperty('qExtendsId')) {
					//console.log('rerunning');
					return this.getPropTree(treeResult.qProperty.qExtendsId);
				//****this processes all the dumb vizlib stuff	
				} else if (treeResult.qProperty.visualization === 'VizlibSheetMenuPlus' || treeResult.qProperty.visualization === 'VizlibContainer') {
					var sheetMenuPaths = utils.getPath(treeResult).filter(i =>{
						//console.log(i);
						var test = i.endsWith('masterItem.id') || i.endsWith('masterItemId');
						return test;
					});
					var sheetMenuMasterItemIds = utils.getValuesFromPaths(treeResult, sheetMenuPaths);
					var sheetMenuMasterItems = Object.entries(sheetMenuMasterItemIds).filter(j => {return j[1] !== ""});
					//console.log(sheetMenuMasterItems);
					
					var children = await Promise.all(sheetMenuMasterItems.map(child => {return this.getPropTree(child[1]);}));
					return children;

				//****************this will process objects that have children by recalling the getPropTree function using each child's ID****************						
				} else if (treeResult.qChildren.length > 0) {
					//console.log(objId+" has "+treeResult.qChildren.length+" children.");
					
					var children = await Promise.all(treeResult.qChildren.map(child => {return this.getPropTree(child.qProperty.qInfo.qId);}));
					return children;
				} else {
					//console.log(treeResult);
					return treeResult;
				}
			},
            processObject: async function(visId, vis, masterItemsArr) {
				//console.log(masterItemsArr);
				return this.getPropTree(visId)
				.then(treeRes => this.processTree(treeRes))
				.then(tree => {
					//go thru each object and find references to qLibraryId
//					console.log(tree);
					var masterItemPaths = utils.getPath(tree).filter(i =>{
						//console.log(i);
						var test = i.includes('qLibraryId');
						//console.log(test);
						return test;
					});
					var masterItemIDs = utils.getValuesFromPaths(tree, masterItemPaths);
					var masterItemsTemp = Object.entries(masterItemIDs).filter(j => {return j[1] !== ""});
					var masterItem;
					//console.log(masterItemsArr);
					masterItemsTemp.forEach(item => {
						//console.log(item); 

						var foundMasterItems = masterItemsArr.filter(i => {
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
					
					var expressionsPaths = utils.getPath(tree).filter(i => {return i.endsWith('.qDef') || i.endsWith('qCond.qv') || i.endsWith('qMsg.qv')}); 
					var expressionsObj = utils.getValuesFromPaths(tree, expressionsPaths);
					var expressionsTemp = Object.entries(expressionsObj).filter(j => {return j[1] !== ""});
					
					var masterItemsFromExp = [];
					expressionsTemp.forEach(item => {
						//console.log(item); 

						var temp = masterItemsArr.filter(i => {
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
			},
            getSheets: async function(){
				const resultSheetsList = await app.getList('sheet');
				return resultSheetsList.layout.qAppObjectList.qItems;
			},
            createDimsList: async function(){
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
			},
            createMeasList: async function(){
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
			},
            createMasterItemsList: async function(){
				let promArray = [];
				let dList = this.createDimsList();
				let mList = this.createMeasList();
				promArray.push(dList);
				promArray.push(mList);
				const masterItemsArray = await Promise.all(promArray);
				//console.log(masterItemsArray[0].concat(masterItemsArray[1]));
				return masterItemsArray[0].concat(masterItemsArray[1]);
			},
            sheetStatus: function(sheetProps) {
                if (sheetProps.qMeta.approved) {
                    return "Public";
                } else if (sheetProps.qMeta.published) {
                    return "Community";
                } else {
                    return "Private";
                }
            },
            deleteMasterItems: function(){
				let toBeDeleted = s.masterItemsData.filter(i => {return i.deleteMe});
				let toBeKept = s.masterItemsData.filter(i => {return !i.deleteMe});
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
							s.masterItemsData = toBeKept;
						}
					})
					.catch(error => {
						console.log("Nope!");
						console.log(error);
					});
				});
			}
        }
    }
});
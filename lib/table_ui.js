define([], function(s) {
    "use strict";
    
    return function(s){
        console.log(s); 

        s.searchResults = {
            "sheetName": "",
            "sheetId": "",
            "vizId": "",
            "vizType": "",
            "name": "",
            "id": "",
            "type": "",
            "sheetStatus": ""
        };

        function isVisible(item){
            let sheetNameMatchesSearch = item.sheetName ? item.sheetName.toLowerCase().includes(s.searchResults.sheetName.toLowerCase()) : false;
            let sheetIdMatchesSearch = item.sheetId ? item.sheetId.toLowerCase().includes(s.searchResults.sheetId.toLowerCase()) : false;
            let vizIdMatchesSearch = item.vizId ? item.vizId.toLowerCase().includes(s.searchResults.vizId.toLowerCase()) : false;
            let vizTypeMatchesSearch = item.vizType ? item.vizType.toLowerCase().includes(s.searchResults.vizType.toLowerCase()) : false;
            let nameMatchesSearch = item.name ? item.name.toLowerCase().includes(s.searchResults.name.toLowerCase()) : false;
            let idMatchesSearch = item.id ? item.id.toLowerCase().includes(s.searchResults.id.toLowerCase()) : false;
            let typeMatchesSearch = item.type ? item.type.toLowerCase().includes(s.searchResults.type.toLowerCase()) : false;
            let sheetStatusMatchesSearch = item.sheetStatus ? item.sheetStatus.toLowerCase().includes(s.searchResults.sheetStatus.toLowerCase()) : false;
            const sheetNameCheck = (sheetNameMatchesSearch || !s.searchResults.sheetName);
            const sheetIdCheck = (sheetIdMatchesSearch || !s.searchResults.sheetId);
            const vizIdCheck = (vizIdMatchesSearch || !s.searchResults.vizId);
            const vizTypeCheck = (vizTypeMatchesSearch || !s.searchResults.vizType);
            const nameCheck = (nameMatchesSearch || !s.searchResults.name);
            const idCheck = (idMatchesSearch || !s.searchResults.id);
            const typeCheck = (typeMatchesSearch || !s.searchResults.type);
            const sheetStatusCheck = (sheetStatusMatchesSearch || !s.searchResults.sheetStatus);
            let searchCheck = sheetNameCheck && sheetIdCheck && vizIdCheck && vizTypeCheck && nameCheck && idCheck && typeCheck && sheetStatusCheck;
            //let showInUseItems = item.masterItemInUse && searchCheck;
            //let showNotInUseItems = !item.masterItemInUse && searchCheck;
            
            //return {"inUseItems": showInUseItems, "notInUseItems": showNotInUseItems};
            item.inSearch = searchCheck;
            return searchCheck;
        }
        //var propertyName = 'sheetName';
        //var reverse = false;
        
        return {
            reverse: false,
            searchResults: s.searchResults,
            sortBy: function(propertyName) {
				s.reverse = (s.propertyName === propertyName) ? !s.reverse : false;
				s.propertyName = propertyName;
				console.log('reverse: '+s.reverse);
				console.log('propertyName: '+s.propertyName);
			},
            toggleSearch: function(e, property){
				$(".searchbar_"+property).toggle();
				console.log(e);
				$(e.currentTarget).next().next().children().focus();
			},
            inUseFilter: function(item){
				return isVisible(item) && item.masterItemInUse;
			},
            notInUseFilter: function(item){
				return isVisible(item) && !item.masterItemInUse;
			},
            itemsSelected: function(){
				let deleteAllButtonEnabled = false;
				if (s.masterItemsData) {
					s.masterItemsData.forEach(item => {
						if (item && item.deleteMe) {
							deleteAllButtonEnabled = true;
						}
					});
				}
				return deleteAllButtonEnabled;
			},
            anyChecked: false,
            toggleAllChecks: function(){
				//Once master items are loaded...
				if(s.masterItemsData) {
					//...determine which are visible at the moment...
					var visibleItems = s.masterItemsData.filter(i => {return i.inSearch && !i.masterItemInUse});
					console.log(visibleItems);
					//...and of those, determine which ones are checked.
					var checkedVisibleItems = visibleItems.filter(i => {return i.deleteMe});
					console.log(checkedVisibleItems);
					var unCheckedVisibleItems = visibleItems.filter(i => {return !i.deleteMe});
					console.log(unCheckedVisibleItems);
					
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
				}
			},
            copy: function(text){
				var data = [new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) })];
				navigator.clipboard.write(data).then(function() {
				  console.log("Copied to clipboard successfully!");
				}, function() {
				  console.error("Unable to write to clipboard. :-(");
				});
			}
        }
    };
});
define([], function () {
    return {
        //This function gets every path in an object. We do this so we can find all references to "qLibraryId", which
        //is the identifying marker for master items, as well as to examine expressions to find any references to 
        //master measures. This also allows us to find any visualizations that are actually master visualizations,
        //which we'll need to know so we can dig into the main visualization's properties.
        getPath: function (jsonObj, currentPath = '') {
            const paths = [];
            console.log(jsonObj);
            
            for (const key in jsonObj) {
                if (jsonObj.hasOwnProperty(key)) {
                    const newPath = currentPath ? `${currentPath}.${key}` : key;

                    if (typeof jsonObj[key] === 'object' && jsonObj[key] !== null) {
                        // Recurse into nested objects
                        paths.push(...this.getPath(jsonObj[key], newPath));
                    } else {
                        // Add the path if it's a leaf node
                        paths.push(newPath);
                    }
                }
            }
            //console.log(paths);
            return paths;
        },

        //This function gets the values of object paths. This allows us to get an expression or the id of a master item.
        getValuesFromPaths: function(jsonObj, pathsArr) {
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
        },

        //This function gets the status of a sheet (Public, Community, Private) 
        sheetStatus: function(sheetProps) {
            if (sheetProps.qMeta.approved) {
                return "Public";
            } else if (sheetProps.qMeta.published) {
                return "Community";
            } else {
                return "Private";
            }
        }
    };
});

var ContentApp = {
    netflixAPI: {
        shaktiLocation: '',
        shaktiLocatorRegex: /"BUILD_IDENTIFIER":"([a-zA-Z0-9]+)"/,
        shaktiBaseURL: 'http://www.netflix.com/api/shakti/{{shaktiLocation}}/pathEvaluator',
        getShaktiLocation: function () {
            
            if (ContentApp.netflixAPI.shaktiLocation != '')
                return ContentApp.netflixAPI.shaktiLocation;

            var matches = ContentApp.netflixAPI.shaktiLocatorRegex.exec($('body').html());
            console.log($('body'));
            //TODO: get the body from the site not the box...
            ContentApp.netflixAPI.shaktiLocation = matches[1];
            return ContentApp.netflixAPI.shaktiLocation;
        },
        cookie: ''
    },


    httpGetters: {
        pathConfig: {
            "seasonPath": "#seasonsNav .seasonItem",
            "seasonIdPath": "a",
            "seasonIdAttr": "data-vid",
            "seasonNumPath": "a",
            "episodeContainer": "#seasonDetail",
            "episodePath": ".episodeList li",
            "episodeIdPath": "",
            "episodeIdAttr": "data-episodeid",
            "episodeNumberPath": ".seqNum",
            "episodeLengthPath": ".episodeBOB .ebob-content .heading .duration",
            "episodeProgressPath": ".episodeBOB .ebob-content .progress-bar-wrapper label:first",
            "episodeTitlePath": ".episodeTitle",
            "episodeDescriptionPath": ".episodeBOB .ebob-content .synopsis"
        },

        //temporary storage of episodes data when loaded from http request, to avoid variable scoping issues
        episodesCache: [],
        seasonNumbersCache: [],
        loadingComplete: false,

        getLolomo: function (callback) {
            var requestBody = { "paths": [["lolomo"]] };

            ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                var lolomo = data.value.lolomo[1];
                callback(lolomo);
            });

        },

        getMyList: function (callback) {
            ContentApp.httpGetters.getLolomo(function (lolomo) {
                var requestBody = { "paths": [["lolomos", lolomo, "mylist", { "from": 0, "to": 25 }]] };

                ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                    var lolomosObj = data.value.lolomos[lolomo];
                    var myListLolomoID = lolomosObj.mylist[2];
                    var myListID = lolomosObj[myListLolomoID][1];
                    var myList = data.value.lists[myListID];
                    var myListShows = [];
                    for (var x in myList) {
                        myListShows.push(myList[x][1]);
                    }
                    callback(myListShows);
                });
            });
        },

        getAllEpisodesForShow: function (showID, callback) {
            var showObject = {};
            var episodesArray = [];

            ContentApp.httpGetters.getSeasonsList(showID, function (showObject, seasonsArray, creatorsArray, mediaType) {
                if (showObject.media_type == "show") {
                    showObject.media_type = "tv";
                    ContentApp.httpGetters.getEpisodesList(seasonsArray, function (episodes) {
                        showObject.episodes = episodes;
                        //push to episodes array
                        //episodes.push({
                        //    id: thisEpID,
                        //    durationInMinutes: thisEpDurationInMinutes,
                        //    showName: showName,
                        //    season: showSeasonNumber
                        //});
                        //console.log(JSON.stringify(episodesArray,null,4));
                        callback(showObject);
                    })
                } else {
                    episodeHash = Object.assign({}, showObject);
                    episodeHash.name = episodeHash['title']
                    episodeHash.episodeId = showID

                    showObject.episodes = [episodeHash];
                    callback(showObject);
                }
            })
        },

        getSeasonsList: function (showID, callback) {
            var requestBody = { "paths": [["videos", showID, ["seasonList", "title", "creators", "maturity", "summary", "releaseYear", "runtime"], { "from": 0, "to": 25 }, ["episodes", "id", "name"]]] };

            ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                try {
                    var showObj = data.value.videos[showID];
                    showObj.rating = data.value.videos[showID].maturity.rating.value;
                    showObj.media_type = data.value.videos[showID].summary.type;
                    delete showObj.maturity;
                    delete showObj.summary;

                    var seasonsListObj = data.value.videos[showID].seasonList;
                    var creatorsList = data.value.videos[showID].creators;
                    var creatorsObj = data.value.person;
                } catch (e) {
                    ContentApp.pageModifiers.displayNotification('Woops! There was a problem adding that title.');
                    return;
                }

                var seasonsArray = [];
                for (var season in seasonsListObj) {
                    var thisSeason = seasonsListObj[season];
                    seasonsArray.push(thisSeason[1]);
                }

                if (typeof creatorsList !== 'undefined') {
                    showObj.creators = [];
                    for (var x in creatorsList) {
                        var id = creatorsList[x][1];
                        var thisCreator = creatorsObj[id];
                        showObj.creators.push(thisCreator.name);
                    }
                }


                callback(showObj, seasonsArray);
            });

        },
        getEpisodesList: function (seasonsArray, callback) {
            var requestPaths = [];
            for (var i = 0; i < seasonsArray.length; i++) {
                requestPaths.push(
                    ["seasons", seasonsArray[i], "episodes", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, "-1"], ["summary", "synopsis", "title", "runtime", "releaseYear" /*, "bookmarkPosition"*/]]
                );
            }
            var requestBody = {
                paths: requestPaths
            };

            ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                var episodesListObj = data.value.seasons;
                var episodesArray = [];
                var seasonNum = 1;

                for (var thisSeasonID in episodesListObj) {
                    var thisSeason = episodesListObj[thisSeasonID];
                    var thisSeasonEpisodes = thisSeason.episodes;

                    for (var thisEpisodeKey in thisSeasonEpisodes) {
                        var thisEpisode = thisSeasonEpisodes[thisEpisodeKey];
                        var epObject = data.value.videos[thisEpisode[1]];
                        epObject['season'] = epObject['summary']['season'];
                        epObject['episode'] = epObject['summary']['episode'];
                        epObject['episodeId'] = epObject['summary']['id'];
                        epObject['seasonId'] = thisSeasonID;
                        epObject['showName'] = epObject['summary']['showTitle'];
                        episodesArray.push(epObject);
                    }
                    seasonNum++;
                }

                callback(episodesArray);

            });
        },

        getShowID: function (showTitle, callback) {
            var showTitleEncoded = encodeURI(showTitle);
            //var requestBody = '{"paths":[["search","' + showTitleEncoded + '",{"from":0,"to":48},["summary","title"]]]}';
            var requestPaths = [];
            requestPaths.push(["search", showTitleEncoded, { from: 0, to: 48 }, ["summary", "title"]]);
            var requestBody = {
                paths: requestPaths
            };
            ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                var showId;
                var videos = data.value.videos || null;
                if (!videos) {
                    return;
                }
                for (var thisShowId in videos) {
                    if (videos[thisShowId].title === showTitle) {
                        showId = thisShowId;
                        break;
                    }
                }
                callback(showId);
            });
        },

        getShowIDSync: function (showTitle, callback) {
            var showTitleEncoded = encodeURI(showTitle);
            //var requestBody = '{"paths":[["search","' + showTitleEncoded + '",{"from":0,"to":48},["summary","title"]]]}';
            var requestPaths = [];
            requestPaths.push(["search", showTitleEncoded, { from: 0, to: 48 }, ["summary", "title"]]);
            var requestBody = {
                paths: requestPaths
            };

            var data = ContentApp.httpGetters.makeNetflixApiRequestSync('POST', requestBody);

            var showId;
            var videos = data.value.videos || null;
            if (!videos) {
                return;
            }
            for (var thisShowId in videos) {
                if (videos[thisShowId].title === showTitle) {
                    showId = thisShowId;
                    break;
                }
            }
            return showId;
        },

        getShowsTitles: function (showIDs, callback) {
            var requestPaths = [];
            for (var i = 0; i < showIDs.length; i++) {
                requestPaths.push(
                    ["videos", showIDs[i], "title"]
                );
            }
            var requestBody = {
                paths: requestPaths
            };

            ContentApp.httpGetters.makeNetflixApiRequest('POST', requestBody, function (data) {
                callback(data.value.videos);
            });

        },

        getShowsTitlesSync: function (showIDs) {
            var requestPaths = [];
            for (var i = 0; i < showIDs.length; i++) {
                requestPaths.push(
                    ["videos", showIDs[i], "title"]
                );
            }
            var requestBody = {
                paths: requestPaths
            };

            var result = ContentApp.httpGetters.makeNetflixApiRequestSync('POST', requestBody);

            if (typeof result.value.videos === ('undefined' || null)) {
                ContentApp.pageModifiers.displayNotification('Woops! There was a problem with Channels for Netflix');
                return;
            }

            return result.value.videos;
        },

        makeNetflixApiRequestSync: function (method, requestBody) {
            var apiUrl = ContentApp.netflixAPI.shaktiBaseURL.replace('{{shaktiLocation}}', ContentApp.netflixAPI.getShaktiLocation());

            // Set up an asynchronous AJAX POST request
            var xhr = new XMLHttpRequest();
            xhr.open(method, apiUrl, false);

            // Set correct header for form data
            xhr.setRequestHeader('Accept', 'application/json,  text/javascript, */*');
            xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate');
            xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.8');
            xhr.setRequestHeader('Connection', 'keep-alive');
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Host', 'www.netflix.com');
            xhr.setRequestHeader('Origin', 'http://www.netflix.com');
            xhr.setRequestHeader('Referer', 'Referer:http://www.netflix.com');


            // Send the request and set status
            xhr.send(JSON.stringify(requestBody, null, 4));

            if (xhr.status === 200) {
                //request success
                var responseBody = JSON.parse(xhr.responseText);

                return responseBody;
            }
            return false;
        },

        makeNetflixApiRequest: function (method, requestBody, callback) {
            var apiUrl = ContentApp.netflixAPI.shaktiBaseURL.replace('{{shaktiLocation}}', ContentApp.netflixAPI.getShaktiLocation());

            // Set up an asynchronous AJAX POST request
            var xhr = new XMLHttpRequest();
            // xhr.setDisableHeaderCheck(true);
            xhr.open(method, apiUrl, true);

            // Set correct header for form data
            xhr.setRequestHeader('Accept', 'application/json,  text/javascript, */*');
            // xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate');
            xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.8');
            xhr.setRequestHeader('Connection', 'keep-alive');
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Host', 'www.netflix.com');
            xhr.setRequestHeader('Origin', 'http://www.netflix.com');
            xhr.setRequestHeader('Referer', 'Referer:http://www.netflix.com');
            // xhr.setRequestHeader('Cookie', ContentApp.netflixAPI.cookie);

            // Handle request state change events
            xhr.onreadystatechange = function xhrStateChange() {
                // If the request completed
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        //request success
                        var responseBody = JSON.parse(xhr.responseText);

                        callback(responseBody);

                    } else {
                        //request failed
                        console.log('----request failed', JSON.stringify(xhr, null, 4));
                    }
                }
            };

            // Send the request and set status
            xhr.send(JSON.stringify(requestBody, null, 4));
        }
    },

    /*
     Base URL for new episode
     */
    linkBaseURL: "http://www.netflix.com/watch/"        //WiPlayer?movieid=
};

var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?netflix\.com/;
/*
document.getElementById("test").addEventListener('click', () => {
    console.log("Popup DOM fully loaded and parsed");

    function modifyDOM() {
        //You can play with your DOM here or check URL against your regex
        console.log('Tab script:');
        console.log(document.body);
        return document.body.innerHTML;
    }


    //We have permission to access the activeTab, so we can call chrome.tabs.executeScript:
    chrome.tabs.executeScript({
        code: '(' + modifyDOM + ')();' //argument here is a string but function.toString() returns function's code
    }, (results) => {
        //Here we have just the innerHTML and not DOM structure
        console.log('Popup script:')
        console.log(results[0]);
    });
});
*/
chrome.browserAction.onClicked.addListener(function (tab) {
    console.log("Button Pressed");
    if (urlRegex.test(tab.url)) {
        console.log("Netflix!!!!");
        ContentApp.httpGetters.getMyList(function (item) {
            console.log(item);
        });
    }
});
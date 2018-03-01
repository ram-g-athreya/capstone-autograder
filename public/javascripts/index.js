$(document).ready(function() {
    function parseQuery(queryString) {
        var query = {};
        var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i].split('=');
            query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
        return query;
    }

    var queryParams = parseQuery(window.location.search);
    for(var key in queryParams) {
        if(key.length) {
            console.log(queryParams[key]);
            $('[name=' + key + ']').val(queryParams[key]);
        }
    }

    $('form').submit(function(e) {
        e.preventDefault();
        var array = $(this).serializeArray();
        var data = {};
        var permalink = window.location.origin + '?';
        for(var index = 0; index < array.length; index++) {
            data[array[index].name] = array[index].value;
            permalink += array[index].name + '=' + encodeURIComponent(array[index].value) + '&';
        }
        permalink = permalink.substring(0, permalink.length - 1);

        $('#result').html('');
        $('#permalink').text(permalink);
        $('#permalink').attr('href', permalink);

        var userids = data.userids.split(',');
        for(var index = 0; index < userids.length; index++) {
            data.userid = userids[index];
            $.ajax({
                type: 'post',
                url: '/',
                data: data,
                success: function(response) {
                    $('#result').append(response);
                }
            });
        }
    });
});
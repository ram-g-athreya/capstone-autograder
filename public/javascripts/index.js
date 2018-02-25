$(document).ready(function() {
    $('form').submit(function(e) {
        e.preventDefault();
        var array = $(this).serializeArray();
        var data = {};
        for(var index = 0; index < array.length; index++) {
            data[array[index].name] = array[index].value;
        }

        $('#result').html('');
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
const express = require('express');
const app = express();
const port = 3000;
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

AWS.config.update({
  region: 'us-east-1', // Change to your desired region
});

const DynamoDB = new AWS.DynamoDB();

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const params = {
    TableName: 'login',
  };

  DynamoDB.scan(params, function (err, data) {
    if (err) {
      console.error('Unable to find login', err);
    } else {
      for (let i = 0; i < data.Items.length; i++) {

        if (
          data.Items[i].email.S === email &&
          data.Items[i].password.S === password
        ) {
          res.redirect(`/user?user_name=${data.Items[i].user_name.S}`);
          return;
        }
      }

      res.send('Login failed');
    }
  });
});

app.get('/login', (req, res) => {
  res.sendFile('./login.html', { root: __dirname });
});


app.get('/register', (req, res) => {
  res.sendFile('./register.html', { root: __dirname });
});

app.post('/register', (req, res) => {
  const { email, user_name, password } = req.body;

  const params = {
    TableName: 'login',
    Key: {
      'email': { S: email }
    }
  };

  // Check if email already exists
  DynamoDB.getItem(params, function (err, data) {
    if (err) {
      console.error('Error registering user:', err);
      res.status(500).send('Internal Server Error');
    } else {
      if (data.Item) {
        // Email already exists
        res.send('The email already exists');
      } else {
        // Email is unique, proceed with registration
        const params = {
          TableName: 'login',
          Item: {
            'email': { S: email },
            'user_name': { S: user_name },
            'password': { S: password }

          }
        };

        DynamoDB.putItem(params, function (err, data) {
          if (err) {
            console.error('Error registering user:', err);
            res.status(500).send('Internal Server Error');
          } else {
            // Registration successful, redirect to login page
            res.redirect('/login');
          }
        });
      }
    }
  });
});

app.get('/user', (req, res) => {
  const user = req.query.user_name;
  res.send(`
        <html>
          <head>
            <title>User Area</title>
          </head>

          <body>
          <a href="/user?user_name=${user}"/>User Area</a>  
          <a href="/subscription?user_name=${user}"/>Subscription Area</a>
          <a href="/query?user_name=${user}"/>Query Area</a>
          <a href="/login"/>Log Out</a>
            <h1>Welcome ${user}</h1>`)
})

app.get('/subscription', (req, res) => {
  const user = req.query.user_name;
  const params = {
    TableName: 'subscription',
    FilterExpression: 'contains (#user_name, :user_name)',
    ExpressionAttributeNames: {
      '#user_name': 'user_name',

    },
    ExpressionAttributeValues: {
      ':user_name': { S: user },

    },
  };
  DynamoDB.scan(params, function (err, data) {
    if (err) {
      console.error('Unable to find the subscription', err);
      res.send(`
      <html>
        <head>
          <title>Subscription Area</title>
        </head>

        <body>
        <a href="/user?user_name=${user}"/>User Area</a>  
        <a href="/subscription?user_name=${user}"/>Subscription Area</a>
        <a href="/query?user_name=${user}"/>Query Area</a>
        <a href="/login"/>Log Out</a>
        No Subscription Found`)
    } else {
      res.send(`
        <html>
          <head>
            <title>Subscription Area</title>
          </head>

          <body>
          <a href="/user?user_name=${user}"/>User Area</a>  
          <a href="/subscription?user_name=${user}"/>Subscription Area</a>
          <a href="/query?user_name=${user}"/>Query Area</a>
          <a href="/login"/>Log Out</a>

        <ul>
              ${data.Items.map(
        (item) => {
          // Define parameters for the pre-signed URL
          const params = {
            Bucket: 's3980059-mybucket',
            Key: 'artist_images/' + item.artist.S + '.jpg',
            Expires: 36000 // Expiration time in seconds (e.g., 1 hour)
          };

          // Generate the pre-signed URL
          const url = s3.getSignedUrl('getObject', params);
          console.log(url)
          return `
                  <li>
                    <img src="${url}" />
                    ${item.artist.S} ${item.title.S}
                    <form action="/remove" method="post">
                      <input type="hidden" name="user_name" value="${user}">
                      <input type="hidden" name="title" value="${item.title.S}">
                      <input type="hidden" name="artist" value="${item.artist.S}">
                      <button type="submit">Remove</button>
                    </form>
                  </li>
                `

        }
      ).join('')}
            </ul>
            `)
    }
  })
})

app.get('/query', (req, res) => {
  const user = req.query.user_name;
  const title = req.query.title;
  const year = req.query.year;
  const artist = req.query.artist;
  const params = req.query.artist ? {
    TableName: 'music',
    FilterExpression: 'contains (#title, :title) AND contains (#year, :year) AND contains (#artist, :artist)',
    ExpressionAttributeNames: {
      '#title': 'title',
      '#year': 'year',
      '#artist': 'artist',
    },
    ExpressionAttributeValues: {
      ':title': { S: title },
      ':year': { S: year },
      ':artist': { S: artist },
    }
  } : {
    TableName: 'music',
  }
  DynamoDB.scan(params, function (err, data) {
    if (err) {
      console.error('Unable to find music', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.send(`
        <html>
          <head>
            <title>Query Area</title>
          </head>

          <body>
          <a href="/user?user_name=${user}"/>User Area</a>  
          <a href="/subscription?user_name=${user}"/>Subscription Area</a>
          <a href="/query?user_name=${user}"/>Query Area</a>
          <a href="/login"/>Log Out</a>

          <form action="/query" method="get">
            <label for="title">Title:</label>
            <input type="hidden" name="user_name" value="${user}">

            <input type="text" id="title" name="title"><br><br>

            <label for="year">Year:</label>
            <input type="text" id="year" name="year"><br><br>

            <label for="artist">Artist:</label>
            <input type="text" id="artist" name="artist"><br><br>

            <button type="submit">Query</button>
          </form>

        <ul>
              ${data.Items.map(
        (item) => {
          // Define parameters for the pre-signed URL
          const params = {
            Bucket: 's3980059-mybucket',
            Key: 'artist_images/' + item.artist.S + '.jpg',
            Expires: 36000 // Expiration time in seconds (e.g., 1 hour)
          };

          // Generate the pre-signed URL
          const url = s3.getSignedUrl('getObject', params);
          console.log(url)
          return `
                  <li>
                    <img src="${url}" />
                    ${item.artist.S} ${item.title.S} ${item.year.S}
                    <form action="/subscribe" method="post">
                      <input type="hidden" name="user_name" value="${user}">
                      <input type="hidden" name="title" value="${item.title.S}">
                      <input type="hidden" name="artist" value="${item.artist.S}">
                      <button type="submit">Subscribe</button>
                    </form>
                  </li>
                `

        }
      ).join('')}
            </ul>
            `)
    }
  })
})

app.get('/dashboard', (req, res) => {
  const user = req.query.user_name;
  const params = {
    TableName: 'music',
  };

  DynamoDB.scan(params, function (err, data) {
    if (err) {
      console.error('Unable to find music', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.send(`
        <html>
          <head>
            <title>Dashboard</title>
          </head>

          <body>
          <a href="/user?user_name=${user}"/>User Area</a>  
          <a href="/subscription?user_name=${user}"/>Subscription Area</a>
          <a href="/query?user_name=${user}"/>Query Area</a>
          <a href="/login"/>Log Out</a>
            <h1>Welcome ${user}</h1>

            <form action="/query" method="post">
            <label for="title">Title:</label>
            <input type="text" id="title" name="title"><br><br>
  
            <label for="year">Year:</label>
            <input type="text" id="year" name="year"><br><br>
  
            <label for="artist">Artist:</label>
            <input type="text" id="artist" name="artist"><br><br>
  
            <button type="submit">Query</button>
          </form>
            <h2>Subscription Area</h2>
            <ul>
              ${data.Items.map(
        (item) => {
          // Define parameters for the pre-signed URL
          const params = {
            Bucket: 's3980059-mybucket',
            Key: 'artist_images/' + item.artist.S + '.jpg',
            Expires: 36000 // Expiration time in seconds (e.g., 1 hour)
          };

          // Generate the pre-signed URL
          const url = s3.getSignedUrl('getObject', params);
          console.log(url)
          return `
                  <li>
                    <img src="${url}" />
                    ${item.artist.S} ${item.title.S} ${item.year.S}
                    <form action="/remove" method="post">
                      <input type="hidden" name="title" value="${item.title.S}">
                      <input type="hidden" name="artist" value="${item.artist.S}">
                      <button type="submit">Remove</button>
                    </form>
                  </li>
                `

        }
      ).join('')}
            </ul>
          </body>
        </html>
      `);
    }
  });
});

app.post('/remove', (req, res) => {
  const title = req.body.title;
  const artist = req.body.artist;
  const user = req.body.user_name;

  const params = {
    TableName: 'subscription',
    Key: {
      'title': { S: title },
      'user_name': { S: user }
    }
  };

  DynamoDB.deleteItem(params, function (err, data) {
    if (err) {
      console.error('Error removing subscription:', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.redirect('/subscription?user_name=' + user);
    }
  });
});

app.post('/subscribe', (req, res) => {
  const title = req.body.title;
  const artist = req.body.artist;
  const user = req.body.user_name;
  const params = {
    TableName: 'subscription',
    Item: {
      'user_name': { S: user },
      'title': { S: title },
      'artist': { S: artist },

    }
  };
  console.log(params)

  DynamoDB.putItem(params, function (err, data) {
    if (err) {
      console.error('Error subscribing music:', err);
      res.status(500).send('Internal Server Error');
    } else {
      res.redirect('/query?user_name=' + user);
    }
  });
});

app.post('/query', (req, res) => {
  const { title, year, artist } = req.body;

  const params = {
    TableName: 'music',
    FilterExpression: 'contains (#title, :title) AND contains (#year, :year) AND contains (#artist, :artist)',
    ExpressionAttributeNames: {
      '#title': 'title',
      '#year': 'year',
      '#artist': 'artist',
    },
    ExpressionAttributeValues: {
      ':title': { S: title },
      ':year': { S: year },
      ':artist': { S: artist },
    },
  };

  DynamoDB.scan(params, function (err, data) {
    if (err) {
      console.error('Unable to query music', err);
      res.status(500).send('Internal Server Error');
    } else {
      if (data.Items.length === 0) {
        res.send('No result is retrieved. Please query again');
      } else {
        // Display queried music results
        const musicList = data.Items.map(item => `${item.artist.S} - ${item.title.S} (${item.year.S})`).join('<br>');
        res.send(musicList);
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

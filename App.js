import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TextInput, ScrollView } from 'react-native';
// import BackgroundTimer from 'react-native-background-timer';

import * as Location from 'expo-location';

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as SQLite from 'expo-sqlite'


const BACKGROUND_LOCATION_TASK = 'background-gps-record6';

// const db = SQLite.openDatabase('db.testDb') // returns Database object
const db = SQLite.openDatabase('db.gpsLogs1') // returns Database object


// 1. Define the task by providing a name and the function that should be executed
// Note: This needs to be called in the global scope (e.g outside of your React components)
// TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async () => {
//   console.log('running periodic task')
//   const now = Date.now();

//   console.log(`Got background fetch call at date: ${new Date(now).toISOString()}`);

//   // Be sure to return the successful result type!
//   return BackgroundFetch.BackgroundFetchResult.NewData;
// });

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  console.log('prediodic task called')
  if (error) {
    // Error occurred - check `error.message` for more details.
    console.log('some error occured in peridodic task', error)
    return;
  }
  if (data) {
    const { locations } = data;

    console.log('received location', JSON.stringify(locations))
    db.transaction(tx => {
      tx.executeSql('INSERT INTO gpsdata (timestamp, latitude, longitude) values (?, ?, ?)', [locations[0].timestamp, locations[0].coords.latitude, locations[0].coords.longitude],
      (txObj, resultSet) => 0,
        // (txObj, resultSet) => setData([...data,
        //     { id: resultSet.insertId, timestamp: resultSet.timestamp, latitude: resultSet.latitude, long: resultSet.longitude }]),
        (txObj, error) => console.log('Error', error))
    })
    // const db = SQLite.openDatabase('dbName', version);

    // do something with the locations captured in the background
  }
  
});

// 2. Register the task at some point in your app by providing the same name,
// and some configuration options for how the background fetch should behave
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function registerBackgroundFetchAsync() {
  console.log('registering')
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
      distanceInterval: 0,
    
    
    // timeInterval: 5000,
    // deferredUpdatesTimeout: 5000,
    // distanceInterval: 0
    // deferredUpdatesInterval: 5000
  });
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  );
  console.log('tracking started?', hasStarted);
  // return BackgroundFetch.registerTaskAsync(BACKGROUND_LOCATION_TASK, {
  //   minimumInterval: 10, // in seconds
  //   // stopOnTerminate: false, // android only,
  //   // startOnBoot: true, // android only
  // });
}

// 3. (Optional) Unregister tasks by specifying the task name
// This will cancel any future background fetch calls that match the given name
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function unregisterBackgroundFetchAsync() {
  console.log('unregistering')
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  // return BackgroundFetch.unregisterTaskAsync(BACKGROUND_LOCATION_TASK);
}

const requestPermissions = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus === 'granted') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus === 'granted') {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        deferredUpdatesInterval: 5000
      });
    }
  }
};

// async function openDatabase(pathToDatabaseFile: string): Promise<SQLite.WebSQLDatabase> {
//   if (!(await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'SQLite')).exists) {
//     await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'SQLite');
//   }
//   await FileSystem.downloadAsync(
//     Asset.fromModule(require(pathToDatabaseFile)).uri,
//     FileSystem.documentDirectory + 'SQLite/myDatabaseName.db'
//   );
//   return SQLite.openDatabase('myDatabaseName.db');
// }




export default function App() {

  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [otherMsg, setOtherMsg] = useState(null);
  const [data, setData] = useState([]);

  fetchDataFromDb = () => {
    db.transaction(tx => {
      // sending 4 arguments in executeSql
      tx.executeSql('SELECT * FROM gpsdata', null, // passing sql query and parameters:null
        // success callback which sends two things Transaction object and ResultSet Object
        (txObj, { rows: { _array } }) => setData(_array) ,
        // failure callback which sends two things Transaction object and Error
        (txObj, error) => console.log('Error ', error)
        ) // end executeSQL
    }) // end transaction
  }
  
  // event handler for new item creation
  insertItemIntoDb = () => {
    db.transaction(tx => {
      tx.executeSql('INSERT INTO gpsdata (timestamp, latitude, longitude) values (?, ?, ?)', [1111, 10, 20],
        (txObj, resultSet) => setData([...data,
            { id: resultSet.insertId, timestamp: resultSet.timestamp, latitude: resultSet.latitude, longitude: resultSet.longitude }]),
        (txObj, error) => console.log('Error', error))
    })
  }

  useEffect(() => {
    (async () => {
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let {status: backgroundStatus} = await Location.requestBackgroundPermissionsAsync();
      setOtherMsg('background permission: ' + String(backgroundStatus));
      if (backgroundStatus !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      // Check if the items table exists if not create it
      // db.transaction(tx => {
      //   tx.executeSql(
      //     'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, count INT)'
      //   )
      // })
      console.log('creating table')
      db.transaction(tx => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS gpsdata (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INT, latitude DECIMAL, longitude DECIMAL)'
        )
      })
      console.log('reading db')
      fetchDataFromDb();

    })();
  }, []);

  const [isRecording, setIsRecording] = React.useState(false);
  const [status, setStatus] = React.useState(null);

  React.useEffect(() => {
    checkStatusAsync();
    
  }, []);

  const checkStatusAsync = async () => {

    const status1 = await BackgroundFetch.getStatusAsync();
    const isRecording1 = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    setStatus(status1);
    setIsRecording(isRecording1);
  };

  const toggleFetchTask = async () => {
    if (isRecording) {
      await unregisterBackgroundFetchAsync();
    } else {
      await registerBackgroundFetchAsync();
    }

    checkStatusAsync();
  };
  const now = Date.now();

  console.log(`Got background fetch call at date: ${new Date(now).toISOString()}`);

  let text = 'Waiting..';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    // text = JSON.stringify(location);
    text = String(location.timestamp) + ": " + String(location.coords.latitude) + ", " +  String(location.coords.longitude)
  }

  return (
    <View style={styles.container}>
      <Text>TIAI GPS logger</Text>
      <Text style={styles.paragraph}>{text}</Text>
      <Text style={styles.paragraph}>{otherMsg}</Text>
      <Text style={styles.paragraph}>Background status: {status && BackgroundFetch.BackgroundFetchStatus[status]}</Text>
      <Text style={styles.paragraph}>Recording: {JSON.stringify(isRecording)}</Text>
      {/* <StatusBar style="auto" /> */}
      {/* <TextInput
        style={{
          height: 40,
          width: 200,
          borderColor: 'gray',
          borderWidth: 1
        }}
        defaultValue="You can type in me"
      /> */}
      <Button
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={toggleFetchTask}
      />

      <Button title="Add new item" onPress={insertItemIntoDb}></Button>
      <Button
        title={'Refresh logs'}
        onPress={fetchDataFromDb}
      />
      <ScrollView styles={{innerHeight: 100}}>
        { data && data.map((row, ind) => 
          <View key={ind}>
            <Text>{row.id}: {row.timestamp} - {row.latitude}, {row.longitude} </Text>
          </View>
        )
        }
      </ScrollView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthFull: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});

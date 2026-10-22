const backupsService = require('../src/features/backups/backups.service');

async function testSchedule() {
  console.log('Testing Auto Backup Schedule features...');

  // 1. Get schedule settings
  const sched1 = await backupsService.getScheduleSettings();
  console.log('Initial schedule settings:', sched1);

  // 2. Set schedule settings to 00:00 (Midnight)
  const sched2 = await backupsService.setScheduleSettings({ enabled: true, time: '00:00' });
  console.log('Updated schedule settings to 00:00:', sched2);
  if (sched2.time !== '00:00' || !sched2.enabled) {
    throw new Error('Schedule settings did not update correctly');
  }

  // 3. Test triggering immediate auto backup
  const backupResult = await backupsService.triggerAutoBackupNow(1);
  console.log('Auto backup trigger result:', backupResult.filename, backupResult.type);
  if (backupResult.type !== 'AUTO') {
    throw new Error('Backup type was not AUTO');
  }

  // 4. Check listBackups includes schedule stats
  const list = await backupsService.listBackups();
  console.log('List backups stats schedule:', list.stats.schedule);
  if (!list.stats.schedule || list.stats.schedule.time !== '00:00') {
    throw new Error('listBackups does not include schedule settings');
  }

  console.log('✅ ALL AUTO BACKUP SCHEDULE TESTS PASSED SUCCESSFULLY!');
}

testSchedule()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

SELECT
  numplan.dnorpattern AS Extension,
  device.name AS PhoneName,
  devicenumplanmap.maxnumcalls AS MaxCalls,
  devicenumplanmap.busytrigger AS BusyTrigger
FROM
  devicenumplanmap
  JOIN numplan ON devicenumplanmap.fknumplan = numplan.pkid
  JOIN device ON devicenumplanmap.fkdevice = device.pkid
WHERE
  numplan.dnorpattern = 'Your_Desired_Extension' -- Extension
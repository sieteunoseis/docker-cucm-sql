SELECT
  enduser.userid,
  enduser.displayname,
  device.name,
  numplan.dnorpattern,
  (
    SELECT
      recordingprofile.name
    FROM
      recordingprofile
    WHERE
      recordingprofile.pkid = devicenumplanmap.fkrecordingprofile
  ) AS recordingprofile
FROM
  enduser
  INNER JOIN enduserdevicemap ON enduserdevicemap.fkenduser = enduser.pkid
  INNER JOIN device ON device.pkid = enduserdevicemap.fkdevice
  INNER JOIN devicenumplanmap ON devicenumplanmap.fkdevice = device.pkid
  INNER JOIN numplan ON numplan.pkid = devicenumplanmap.fknumplan
WHERE
  devicenumplanmap.fkrecordingprofile IS NOT NULL
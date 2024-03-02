SELECT
  eu.userid,
  eu.displayname,
  dev.name,
  np.dnorpattern,
  (
    SELECT
      recordingprofile.name
    FROM
      recordingprofile
    WHERE
      recordingprofile.pkid = dnpm.fkrecordingprofile
  ) AS recordingprofilename,
  trf.name AS recflag
FROM
  enduser AS eu,
  enduserdevicemap AS eudm,
  device AS dev,
  devicenumplanmap AS dnpm,
  numplan AS np,
  recordingdynamic AS rd,
  typerecordingflag AS trf
WHERE
  eu.pkid = eudm.fkenduser
  AND eudm.fkdevice = dev.pkid
  AND dev.pkid = dnpm.fkdevice
  AND dnpm.fknumplan = np.pkid
  AND dnpm.pkid = rd.fkdevicenumplanmap
  AND rd.tkrecordingflag = trf.enum
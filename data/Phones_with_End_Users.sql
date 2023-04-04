-- Phones that have a device-level user association.
SELECT
  eu.userid,
  d.name,
  d.description,
  n.dnorpattern AS DN,
  rp.name AS PARTITION
FROM
  device AS d
  INNER JOIN devicenumplanmap AS dnpm ON dnpm.fkdevice = d.pkid
  INNER JOIN enduserdevicemap AS eudm ON eudm.fkdevice = d.pkid
  INNER JOIN enduser AS eu ON eudm.fkenduser = eu.pkid
  INNER JOIN numplan AS n ON dnpm.fknumplan = n.pkid
  INNER JOIN routepartition AS rp ON n.fkroutepartition = rp.pkid
  AND d.tkclass = 1
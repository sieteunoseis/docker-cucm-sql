SELECT
  COUNT(d.name),
  tss.servicename
FROM
  device AS d
  INNER JOIN TelecasterSubscribedService AS tss ON tss.fkdevice = d.pkid
GROUP BY
  tss.servicename
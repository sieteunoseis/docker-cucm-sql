SELECT
  d.name AS DeviceName,
  d.description AS DeviceDescription,
  n.dnorpattern AS LineTextLabel
FROM
  device AS d
  JOIN devicenumplanmap AS dnpm ON d.pkid = dnpm.fkdevice
  JOIN numplan AS n ON dnpm.fknumplan = n.pkid
WHERE
  n.dnorpattern LIKE 'Line Text Label'
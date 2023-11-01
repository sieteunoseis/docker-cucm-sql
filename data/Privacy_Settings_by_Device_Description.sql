SELECT
  d.name AS PhoneName,
  d.description AS DeviceDescription,
  CASE
    WHEN dpd.tkstatus_callinfoprivate = 1 THEN 'On'
    WHEN dpd.tkstatus_callinfoprivate = 0 THEN 'Off'
    ELSE 'Default'
  END AS PrivacySetting
FROM
  device AS d
  LEFT JOIN deviceprivacydynamic AS dpd ON d.pkid = dpd.fkdevice
WHERE
  d.description LIKE '%%' -- Enter your search criteria here
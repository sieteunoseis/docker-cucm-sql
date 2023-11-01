SELECT
  Device.name,
  Device.description,
  DevicePool.name AS DevicePool,
  Typemodel.name AS Typemodel
FROM
  device,
  typemodel,
  devicepool
WHERE
  Device.fkdevicepool = DevicePool.pkid
  AND Device.tkmodel = Typemodel.enum
  AND Typemodel.name LIKE '%Media Termination%'
ORDER BY
  Typemodel.name DESC,
  Device.name ASC
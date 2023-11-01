SELECT
  Device.name,
  Device.description,
  DevicePool.name AS DevicePool,
  LOCATION.name AS LOCATION,
  Typemodel.name AS Typemodel
FROM
  device,
  typemodel,
  devicepool,
  LOCATION
WHERE
  Device.fklocation = LOCATION.pkid
  AND Device.fkdevicepool = DevicePool.pkid
  AND Device.tkmodel = Typemodel.enum
  AND Typemodel.name LIKE '%Conference%'
ORDER BY
  Typemodel.name DESC,
  Device.name ASC
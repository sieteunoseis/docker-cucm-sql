SELECT
  Devicepool.name AS DevicePool,
  device.name AS DeviceName
FROM
  Devicepool
  INNER JOIN Device ON Device.fkDevicepool = DevicePool.pkid
WHERE
  device.name LIKE 'SEP%'
ORDER BY
  DevicePool
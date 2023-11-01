SELECT
  SUM(analog_phones) AS analog_phones,
  SUM(ip_phones) AS ip_phones,
  devicepool
FROM
  (
    SELECT
      0 AS analog_phones,
      COUNT(d.name) AS IP_Phones,
      dp.name AS DevicePool
    FROM
      Device AS d
      INNER JOIN DevicePool AS dp ON d.fkDevicePool = dp.pkid
      INNER JOIN typemodel AS tm ON tm.enum = d.tkmodel
    WHERE
      d.tkclass = 1
    GROUP BY
      dp.name
    UNION ALL
    SELECT
      COUNT(d.name) AS Analog_Phones,
      0 AS ip_phones,
      dp.name AS DevicePool
    FROM
      Device AS d
      INNER JOIN DevicePool AS dp ON d.fkDevicePool = dp.pkid
      INNER JOIN typemodel AS tm ON tm.enum = d.tkmodel
    WHERE
      (tm.name = 'Analog Phone')
    GROUP BY
      dp.name
  ) a
GROUP BY
  devicepool
ORDER BY
  devicepool
SELECT
  mrg.name AS mrg,
  d.name AS resource
FROM
  mediaresourcegroup mrg
  INNER JOIN mediaresourcegroupmember mgm ON mgm.fkmediaresourcegroup = mrg.pkid
  INNER JOIN device d ON mgm.fkdevice = d.pkid
SELECT rdp.NAME      AS remotedestinationprofile,
       n.dnorpattern AS line,
       rp.NAME       AS Partiton,
       r.NAME        AS remotedestination,
       rd.destination
FROM   remotedestinationdynamic rd
       INNER JOIN remotedestination r
               ON rd.fkremotedestination = r.pkid
       INNER JOIN device AS rdp
               ON rdp.pkid = r.fkdevice_remotedestinationtemplate
       INNER JOIN devicenumplanmap AS dmap
               ON dmap.fkdevice = rdp.pkid
       INNER JOIN numplan AS n
               ON n.pkid = dmap.fknumplan
       INNER JOIN routepartition AS rp
               ON n.fkroutepartition = rp.pkid 
